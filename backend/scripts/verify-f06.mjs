import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

try { process.loadEnvFile(".env"); } catch { /* CI puede proporcionar DATABASE_URL. */ }
if (!process.env.DATABASE_URL) throw new Error("Falta DATABASE_URL para la prueba F06");
const require = createRequire(import.meta.url);
const { PrismaClient } = require("../dist/generated/prisma/client.js");
const { ReservationsService } = require("../dist/src/reservations/reservations.service.js");
const { CheckoutService } = require("../dist/src/reservations/checkout.service.js");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, max: 2 }) });
const rollback = Symbol("rollback esperado");
const stamp = randomUUID().slice(0, 8);

try {
  await prisma.$transaction(async (tx) => {
    // La capa de servicio comparte esta transacción; lanzar rollback descarta hasta los IDs de idempotencia.
    const db = { client: new Proxy(tx, { get(target, property) {
      if (property === "$transaction") return async (callback) => callback(tx);
      return Reflect.get(target, property);
    } }) };
    const reservations = new ReservationsService(db);
    const checkout = new CheckoutService(db);
    const customer = await tx.usuario.create({ data: { fullName: `Prueba F06 ${stamp}` } });
    const category = await tx.categoria.create({ data: { name: `Prueba F06 ${stamp}`, slug: `f06-${stamp}` } });
    const venue = await tx.ubicacion.create({ data: { name: `Recinto F06 ${stamp}` } });
    const event = await tx.evento.create({ data: {
      categoryId: category.id, venueId: venue.id, organizerId: customer.id,
      title: `Prueba F06 ${stamp}`, slug: `f06-${stamp}`,
      startsAt: new Date(Date.now() + 86_400_000), endsAt: new Date(Date.now() + 90_000_000),
      timezone: "America/Mexico_City", capacityLimit: 5, status: "published",
    } });
    const ticket = await tx.tipoTicket.create({ data: { eventId: event.id, name: "General", priceCents: 25000n,
      quantityTotal: 1, maxPerOrder: 4, maxPerUser: 4, status: "active" } });
    await tx.inventario.create({ data: { ticketTypeId: ticket.id } });
    const selection = { eventId: event.id, items: [{ ticketTypeId: ticket.id, quantity: 1 }] };
    const first = await reservations.create(customer.id, selection, `f06-${stamp}-first`);
    assert.equal(first.totalCents, 25000);
    assert.equal((await reservations.create(customer.id, selection, `f06-${stamp}-first`)).id, first.id);
    await assert.rejects(reservations.create(customer.id, selection, `f06-${stamp}-soldout`), (error) => error?.response?.code === "SOLD_OUT");
    const order = await checkout.create(customer.id, first.id, `f06-${stamp}-checkout`);
    assert.equal(order.status, "awaiting_payment");
    assert.equal((await checkout.create(customer.id, first.id, `f06-${stamp}-checkout2`)).purchaseId, order.purchaseId);
    await tx.tipoTicket.update({ where: { id: ticket.id }, data: { priceCents: 99000n } });
    assert.equal((await checkout.getPurchase(customer.id, order.purchaseId)).totalCents, 25000);
    await reservations.cancel(customer.id, first.id);
    await reservations.cancel(customer.id, first.id);
    assert.equal((await tx.inventario.findUniqueOrThrow({ where: { ticketTypeId: ticket.id } })).reservedCount, 0);
    assert.equal((await checkout.getPurchase(customer.id, order.purchaseId)).status, "cancelled");
    const second = await reservations.create(customer.id, selection, `f06-${stamp}-second`);
    await tx.reserva.update({ where: { id: second.id }, data: {
      createdAt: new Date(Date.now() - 360_000), expiresAt: new Date(Date.now() - 60_000),
    } });
    assert.equal(await reservations.expireBatch(), 1);
    assert.equal(await reservations.expireBatch(), 0);
    assert.equal((await tx.inventario.findUniqueOrThrow({ where: { ticketTypeId: ticket.id } })).reservedCount, 0);
    const third = await reservations.create(customer.id, selection, `f06-${stamp}-third`);
    assert.equal(third.status, "active");
    await reservations.cancel(customer.id, third.id);
    await tx.tipoTicket.update({ where: { id: ticket.id }, data: { quantityTotal: 5 } });
    await reservations.create(customer.id, { eventId: event.id, items: [{ ticketTypeId: ticket.id, quantity: 4 }] }, `f06-${stamp}-limit`);
    await assert.rejects(reservations.create(customer.id, selection, `f06-${stamp}-overlimit`),
      (error) => error?.response?.code === "LIMIT_EXCEEDED");
    console.log("F06 PostgreSQL: inventario, límite, idempotencia, compra, precio fijo y expiración correctos.");
    throw rollback;
  }, { timeout: 30_000 });
} catch (error) {
  if (error !== rollback) throw error;
} finally {
  await prisma.$disconnect();
}
