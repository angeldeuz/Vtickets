import { createHash } from "node:crypto";
import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../database/prisma.service";
import type { ReservationCreate } from "./reservations.schemas";

const MAX_PER_EVENT = 4;
const HOLD_MS = 10 * 60 * 1000;
type Tx = Prisma.TransactionClient;

function conflict(code: string, message: string): never {
  throw new ConflictException({ code, message });
}

function fingerprint(input: ReservationCreate): string {
  const items = [...input.items].sort((a, b) => a.ticketTypeId.localeCompare(b.ticketTypeId));
  return createHash("sha256").update(JSON.stringify({ eventId: input.eventId, items })).digest("hex");
}

// Reconciliar antes de comprobar stock impide que una reserva vencida siga bloqueando unidades.
// El evento y las reservas ya están bloqueados; todos los inventarios se bloquean por UUID.
async function expireForEvent(tx: Tx, eventId: string, now: Date, requestedIds: string[]) {
  const expired = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM tickets_app.reservas
    WHERE event_id = ${eventId}::uuid AND status = 'active' AND expires_at <= ${now}
    ORDER BY id FOR UPDATE
  `;
  const expiredIds = expired.map((item) => item.id);
  const details = expiredIds.length ? await tx.reservaDetalle.findMany({
    where: { reservationId: { in: expiredIds } }, select: { ticketTypeId: true, quantity: true },
  }) : [];
  const allIds = [...new Set([...requestedIds, ...details.map((item) => item.ticketTypeId)])].sort();
  if (allIds.length) {
    await tx.$queryRaw(Prisma.sql`
      SELECT ticket_type_id FROM tickets_app.inventarios
      WHERE ticket_type_id IN (${Prisma.join(allIds.map((id) => Prisma.sql`${id}::uuid`))})
      ORDER BY ticket_type_id FOR UPDATE
    `);
  }
  if (expiredIds.length) {
    const changed = await tx.reserva.updateMany({ where: { id: { in: expiredIds }, status: "active" }, data: { status: "expired", updatedAt: now } });
    if (changed.count !== expiredIds.length) conflict("RESERVATION_STATE", "La reserva cambió durante la expiración");
    const released = new Map<string, number>();
    for (const detail of details) released.set(detail.ticketTypeId, (released.get(detail.ticketTypeId) ?? 0) + detail.quantity);
    for (const [ticketTypeId, quantity] of [...released].sort(([a], [b]) => a.localeCompare(b))) {
      const inventory = await tx.inventario.updateMany({
        where: { ticketTypeId, reservedCount: { gte: quantity } }, data: { reservedCount: { decrement: quantity }, updatedAt: now },
      });
      if (inventory.count !== 1) conflict("INVENTORY_INCONSISTENT", "El inventario necesita revisión");
    }
    await tx.compra.updateMany({ where: { reservationId: { in: expiredIds }, status: "awaiting_payment" }, data: { status: "cancelled", updatedAt: now } });
  }
  return expiredIds.length;
}

@Injectable()
export class ReservationsService {
  constructor(private readonly database: PrismaService) {}

  // El worker llama este método periódicamente; un reinicio no pierde vencimientos.
  async expireBatch(): Promise<number> {
    const due = await this.database.client.reserva.findMany({
      where: { status: "active", expiresAt: { lte: new Date() } },
      select: { eventId: true }, distinct: ["eventId"], orderBy: { expiresAt: "asc" }, take: 20,
    });
    let expired = 0;
    for (const { eventId } of due) {
      expired += await this.database.client.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM tickets_app.eventos WHERE id = ${eventId}::uuid FOR SHARE`;
        const clock = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`;
        return expireForEvent(tx, eventId, clock[0].now, []);
      }, { timeout: 10_000 });
    }
    return expired;
  }

  async get(customerId: string, id: string) {
    const reservation = await this.database.client.reserva.findFirst({
      where: { id, customerId },
      include: { fromReservaDetalleReservationIdEventId: { select: {
        ticketTypeId: true, quantity: true, unitPriceCents: true, lineTotalCents: true,
      } } },
    });
    if (!reservation) throw new NotFoundException("Reserva no disponible");
    return { id: reservation.id, status: reservation.status === "active" && reservation.expiresAt <= new Date() ? "expired" : reservation.status,
      expiresAt: reservation.expiresAt.toISOString(), currency: reservation.currency, totalCents: Number(reservation.totalCents),
      items: reservation.fromReservaDetalleReservationIdEventId.map((line) => ({
        ticketTypeId: line.ticketTypeId, quantity: line.quantity,
        unitPriceCents: Number(line.unitPriceCents), lineTotalCents: Number(line.lineTotalCents),
      })) };
  }

  async cancel(customerId: string, id: string): Promise<void> {
    const lookup = await this.database.client.reserva.findFirst({ where: { id, customerId }, select: { eventId: true } });
    if (!lookup) throw new NotFoundException("Reserva no disponible");
    await this.database.client.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM tickets_app.eventos WHERE id = ${lookup.eventId}::uuid FOR SHARE`;
      await tx.$queryRaw`SELECT id FROM tickets_app.usuarios WHERE id = ${customerId}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM tickets_app.reservas WHERE id = ${id}::uuid FOR UPDATE`;
      const reservation = await tx.reserva.findFirst({ where: { id, customerId }, select: { status: true, expiresAt: true } });
      if (!reservation) throw new NotFoundException("Reserva no disponible");
      if (reservation.status === "converted") conflict("RESERVATION_CONVERTED", "La reserva ya se convirtió en compra");
      if (reservation.status !== "active") return;
      const details = await tx.reservaDetalle.findMany({ where: { reservationId: id }, select: { ticketTypeId: true, quantity: true } });
      if (!details.length) conflict("INVENTORY_INCONSISTENT", "La reserva no tiene entradas que liberar");
      const ids = details.map((line) => line.ticketTypeId).sort();
      await tx.$queryRaw(Prisma.sql`SELECT ticket_type_id FROM tickets_app.inventarios
        WHERE ticket_type_id IN (${Prisma.join(ids.map((ticketTypeId) => Prisma.sql`${ticketTypeId}::uuid`))})
        ORDER BY ticket_type_id FOR UPDATE`);
      const clock = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`;
      const now = clock[0].now;
      await tx.reserva.update({ where: { id }, data: { status: now >= reservation.expiresAt ? "expired" : "cancelled", updatedAt: now } });
      for (const line of details.sort((a, b) => a.ticketTypeId.localeCompare(b.ticketTypeId))) {
        const inventory = await tx.inventario.updateMany({ where: { ticketTypeId: line.ticketTypeId, reservedCount: { gte: line.quantity } },
          data: { reservedCount: { decrement: line.quantity }, updatedAt: now } });
        if (inventory.count !== 1) conflict("INVENTORY_INCONSISTENT", "El inventario necesita revisión");
      }
      await tx.compra.updateMany({ where: { reservationId: id, status: "awaiting_payment" }, data: { status: "cancelled", updatedAt: now } });
    }, { timeout: 10_000 });
  }

  async create(customerId: string, input: ReservationCreate, idempotencyKey: string) {
    const requestSha256 = fingerprint(input);
    return this.database.client.$transaction(async (tx) => {
      const lockedEvent = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM tickets_app.eventos WHERE id = ${input.eventId}::uuid FOR SHARE
      `;
      if (!lockedEvent.length) throw new NotFoundException("Evento no disponible");
      await tx.$queryRaw`SELECT id FROM tickets_app.usuarios WHERE id = ${customerId}::uuid FOR UPDATE`;
      const prior = await tx.idempotenciaSolicitud.findUnique({ where: { userId_idempotencyKey: { userId: customerId, idempotencyKey } } });
      if (prior) {
        if (prior.requestSha256 !== requestSha256) conflict("IDEMPOTENCY_CONFLICT", "La clave ya se usó con otra selección");
        if (prior.status !== "completed" || !prior.responseBody) conflict("REQUEST_IN_PROGRESS", "La solicitud todavía se está procesando");
        return prior.responseBody;
      }

      const clock = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`;
      const now = clock[0].now;
      const event = await tx.evento.findUnique({ where: { id: input.eventId }, select: {
        status: true, startsAt: true, salesStartsAt: true, salesEndsAt: true,
      } });
      if (!event || event.status !== "published" || now >= event.startsAt ||
        (event.salesStartsAt && now < event.salesStartsAt) ||
        (event.salesEndsAt && now >= event.salesEndsAt)) {
        conflict("EVENT_NOT_ON_SALE", "El evento no está disponible para reservar");
      }

      const requestedIds = input.items.map((item) => item.ticketTypeId).sort();
      await expireForEvent(tx, input.eventId, now, requestedIds);
      const ticketTypes = await tx.tipoTicket.findMany({
        where: { eventId: input.eventId, id: { in: requestedIds }, status: "active" },
        include: { fromInventarioTicketTypeId: true },
      });
      if (ticketTypes.length !== requestedIds.length) conflict("TICKET_TYPE_UNAVAILABLE", "Una entrada ya no está disponible");
      const byId = new Map(ticketTypes.map((ticket) => [ticket.id, ticket]));

      const activeDetails = await tx.reservaDetalle.findMany({ where: {
        eventId: input.eventId, refReservationIdEventId: { customerId, status: "active", expiresAt: { gt: now } },
      }, select: { ticketTypeId: true, quantity: true } });
      const paidDetails = await tx.compraDetalle.findMany({ where: {
        eventId: input.eventId, refPurchaseIdEventId: { customerId, status: { in: ["paid", "partially_refunded"] } },
      }, select: { ticketTypeId: true, quantity: true } });
      const committed = [...activeDetails, ...paidDetails];
      const alreadyHeld = committed.reduce((sum, detail) => sum + detail.quantity, 0);
      const requested = input.items.reduce((sum, item) => sum + item.quantity, 0);
      if (alreadyHeld + requested > MAX_PER_EVENT) conflict("LIMIT_EXCEEDED", "Ya alcanzaste el límite de 4 entradas para este evento");

      const lines = input.items.map((item) => {
        const ticket = byId.get(item.ticketTypeId)!;
        const start = ticket.salesStartsAt ?? event.salesStartsAt;
        const end = ticket.salesEndsAt ?? event.salesEndsAt ?? event.startsAt;
        if ((start && now < start) || now >= end) conflict("TICKET_TYPE_UNAVAILABLE", "La venta de una entrada no está abierta");
        if (item.quantity > ticket.maxPerOrder ||
          item.quantity + committed.filter((detail) => detail.ticketTypeId === ticket.id).reduce((sum, detail) => sum + detail.quantity, 0) > ticket.maxPerUser) {
          conflict("LIMIT_EXCEEDED", "La cantidad supera el límite de este tipo de entrada");
        }
        const inventory = ticket.fromInventarioTicketTypeId;
        if (!inventory || ticket.quantityTotal - inventory.reservedCount - inventory.soldCount < item.quantity) {
          conflict("SOLD_OUT", "No quedan suficientes entradas de este tipo");
        }
        const lineTotalCents = ticket.priceCents * BigInt(item.quantity);
        return { ticketTypeId: ticket.id, quantity: item.quantity, unitPriceCents: ticket.priceCents, lineTotalCents };
      });
      const totalCents = lines.reduce((sum, line) => sum + line.lineTotalCents, 0n);
      const expiresAt = new Date(now.getTime() + HOLD_MS);
      const reservation = await tx.reserva.create({ data: {
        eventId: input.eventId, customerId, expiresAt, totalCents, createdAt: now, updatedAt: now,
      }, select: { id: true } });
      // La FK compuesta exige eventId en cada detalle. createMany acepta los escalares
      // y permanece en la misma transacción que la reserva y el inventario.
      await tx.reservaDetalle.createMany({ data: lines.map((line) => ({
        reservationId: reservation.id, eventId: input.eventId, ticketTypeId: line.ticketTypeId,
        quantity: line.quantity, unitPriceCents: line.unitPriceCents, lineTotalCents: line.lineTotalCents,
      })) });
      for (const line of [...lines].sort((a, b) => a.ticketTypeId.localeCompare(b.ticketTypeId))) {
        await tx.inventario.update({ where: { ticketTypeId: line.ticketTypeId }, data: {
          reservedCount: { increment: line.quantity }, updatedAt: now,
        } });
      }
      const response = { id: reservation.id, status: "active", expiresAt: expiresAt.toISOString(), currency: "MXN",
        items: lines.map((line) => ({ ticketTypeId: line.ticketTypeId, quantity: line.quantity,
          unitPriceCents: Number(line.unitPriceCents), lineTotalCents: Number(line.lineTotalCents) })),
        totalCents: Number(totalCents) };
      await tx.idempotenciaSolicitud.create({ data: { userId: customerId, idempotencyKey, requestSha256,
        status: "completed", responseStatus: 201, responseBody: response, expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000) } });
      return response;
    }, { timeout: 10_000 });
  }
}
