import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { PrismaPg } from "@prisma/adapter-pg";

try { process.loadEnvFile("../database/.env.pruebas"); } catch { /* CI puede proporcionar TEST_DATABASE_URL. */ }
if (!process.env.TEST_DATABASE_URL) throw new Error("Falta TEST_DATABASE_URL para F06 concurrente");
const require = createRequire(import.meta.url);
const { PrismaClient } = require("../dist/generated/prisma/client.js");
const { ReservationsService } = require("../dist/src/reservations/reservations.service.js");
const { CheckoutService } = require("../dist/src/reservations/checkout.service.js");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.TEST_DATABASE_URL, max: 6 }) });
const service = new ReservationsService({ client: prisma });
const checkout = new CheckoutService({ client: prisma });
const stamp = randomUUID().slice(0, 8);
const ids = { customers: [], event: null, ticket: null, venue: null, category: null };

try {
  const customers = await Promise.all([0, 1].map((number) => prisma.usuario.create({ data: { fullName: `F06 ${stamp} ${number}` } })));
  ids.customers = customers.map((customer) => customer.id);
  const category = await prisma.categoria.create({ data: { name: `F06 ${stamp}`, slug: `f06-${stamp}` } });
  ids.category = category.id;
  const venue = await prisma.ubicacion.create({ data: { name: `F06 ${stamp}` } });
  ids.venue = venue.id;
  const event = await prisma.evento.create({ data: { categoryId: category.id, venueId: venue.id,
    organizerId: customers[0].id, title: `Prueba F06 ${stamp}`, slug: `f06-${stamp}`,
    startsAt: new Date(Date.now() + 86_400_000), endsAt: new Date(Date.now() + 90_000_000),
    timezone: "America/Mexico_City", capacityLimit: 5, status: "published" } });
  ids.event = event.id;
  const ticket = await prisma.tipoTicket.create({ data: { eventId: event.id, name: "General", priceCents: 25000n,
    quantityTotal: 1, maxPerOrder: 4, maxPerUser: 4, status: "active" } });
  ids.ticket = ticket.id;
  await prisma.inventario.create({ data: { ticketTypeId: ticket.id } });
  const selection = (quantity) => ({ eventId: event.id, items: [{ ticketTypeId: ticket.id, quantity }] });

  const race = await Promise.allSettled(customers.map((customer, index) =>
    service.create(customer.id, selection(1), `f06-${stamp}-race-${index}`)));
  assert.equal(race.filter((result) => result.status === "fulfilled").length, 1, "Solo un cliente debe obtener el último boleto");
  assert.equal(race.filter((result) => result.status === "rejected" && result.reason?.response?.code === "SOLD_OUT").length, 1);
  const winner = race.find((result) => result.status === "fulfilled").value;
  const winnerId = customers[race.findIndex((result) => result.status === "fulfilled")].id;
  assert.equal((await prisma.inventario.findUniqueOrThrow({ where: { ticketTypeId: ticket.id } })).reservedCount, 1);
  const orders = await Promise.all([0, 1].map((index) => checkout.create(winnerId, winner.id, `f06-${stamp}-checkout-${index}`)));
  assert.equal(orders[0].purchaseId, orders[1].purchaseId, "Una reserva produce una sola compra");
  await service.cancel(winnerId, winner.id);
  await prisma.tipoTicket.update({ where: { id: ticket.id }, data: { quantityTotal: 5 } });

  const limit = await Promise.allSettled([0, 1].map((index) =>
    service.create(customers[0].id, selection(3), `f06-${stamp}-limit-${index}`)));
  assert.equal(limit.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(limit.filter((result) => result.status === "rejected" && result.reason?.response?.code === "LIMIT_EXCEEDED").length, 1);
  const held = limit.find((result) => result.status === "fulfilled").value;
  await prisma.reserva.update({ where: { id: held.id }, data: {
    createdAt: new Date(Date.now() - 360_000), expiresAt: new Date(Date.now() - 60_000),
  } });
  // Nueva instancia: la recuperación depende de filas persistidas, no del proceso que reservó.
  const restartedWorker = new ReservationsService({ client: prisma });
  await restartedWorker.expireBatch();
  assert.equal((await prisma.reserva.findUniqueOrThrow({ where: { id: held.id } })).status, "expired");
  assert.equal((await prisma.inventario.findUniqueOrThrow({ where: { ticketTypeId: ticket.id } })).reservedCount, 0);
  await restartedWorker.expireBatch();
  assert.equal((await prisma.inventario.findUniqueOrThrow({ where: { ticketTypeId: ticket.id } })).reservedCount, 0);
  console.log("F06 en Vtickets-pruebas: último boleto, límite por usuario y checkout concurrentes; expiración idempotente.");
} finally {
  // El proyecto de pruebas permite borrar solo las filas propias, en orden inverso a las FK.
  try {
    if (ids.event) {
      const reservations = await prisma.reserva.findMany({ where: { eventId: ids.event }, select: { id: true } });
      const reservationIds = reservations.map((reservation) => reservation.id);
      const purchases = await prisma.compra.findMany({ where: { eventId: ids.event }, select: { id: true } });
      await prisma.compraDetalle.deleteMany({ where: { purchaseId: { in: purchases.map((purchase) => purchase.id) } } });
      await prisma.compra.deleteMany({ where: { eventId: ids.event } });
      await prisma.reservaDetalle.deleteMany({ where: { reservationId: { in: reservationIds } } });
      await prisma.reserva.deleteMany({ where: { eventId: ids.event } });
    }
    if (ids.customers.length) await prisma.idempotenciaSolicitud.deleteMany({ where: { userId: { in: ids.customers } } });
    if (ids.ticket) { await prisma.inventario.delete({ where: { ticketTypeId: ids.ticket } }); await prisma.tipoTicket.delete({ where: { id: ids.ticket } }); }
    if (ids.event) await prisma.evento.delete({ where: { id: ids.event } });
    if (ids.venue) await prisma.ubicacion.delete({ where: { id: ids.venue } });
    if (ids.category) await prisma.categoria.delete({ where: { id: ids.category } });
    if (ids.customers.length) await prisma.usuario.deleteMany({ where: { id: { in: ids.customers } } });
  } finally { await prisma.$disconnect(); }
}
