import { createHash } from "node:crypto";
import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";

function conflict(code: string, message: string): never {
  throw new ConflictException({ code, message });
}

@Injectable()
export class CheckoutService {
  constructor(private readonly database: PrismaService) {}

  async create(customerId: string, reservationId: string, idempotencyKey: string) {
    const requestSha256 = createHash("sha256").update(`checkout:${reservationId}`).digest("hex");
    const lookup = await this.database.client.reserva.findFirst({
      where: { id: reservationId, customerId }, select: { eventId: true },
    });
    if (!lookup) throw new NotFoundException("Reserva no disponible");

    return this.database.client.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM tickets_app.eventos WHERE id = ${lookup.eventId}::uuid FOR SHARE`;
      await tx.$queryRaw`SELECT id FROM tickets_app.usuarios WHERE id = ${customerId}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM tickets_app.reservas WHERE id = ${reservationId}::uuid FOR UPDATE`;
      const prior = await tx.idempotenciaSolicitud.findUnique({ where: { userId_idempotencyKey: { userId: customerId, idempotencyKey } } });
      if (prior) {
        if (prior.requestSha256 !== requestSha256) conflict("IDEMPOTENCY_CONFLICT", "La clave ya se usó con otra operación");
        if (prior.status !== "completed" || !prior.responseBody) conflict("REQUEST_IN_PROGRESS", "La solicitud todavía se está procesando");
        return prior.responseBody;
      }

      const clock = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`;
      const now = clock[0].now;
      const reservation = await tx.reserva.findFirst({ where: { id: reservationId, customerId },
        include: { fromReservaDetalleReservationIdEventId: { select: {
          ticketTypeId: true, quantity: true, unitPriceCents: true, lineTotalCents: true,
        } } } });
      if (!reservation) throw new NotFoundException("Reserva no disponible");
      if (reservation.status !== "active" || now >= reservation.expiresAt) {
        conflict("RESERVATION_EXPIRED", "La reserva ya no está vigente");
      }
      if (reservation.fromReservaDetalleReservationIdEventId.length === 0) {
        conflict("RESERVATION_EMPTY", "La reserva no tiene entradas");
      }
      const existing = await tx.compra.findUnique({ where: { reservationId }, select: { id: true, status: true } });
      if (existing) {
        if (existing.status !== "awaiting_payment") conflict("PURCHASE_STATE", "La compra ya no admite checkout");
        const response = { purchaseId: existing.id, status: existing.status, checkoutUrl: null,
          expiresAt: reservation.expiresAt.toISOString() };
        await tx.idempotenciaSolicitud.create({ data: { userId: customerId, idempotencyKey, requestSha256,
          status: "completed", responseStatus: 201, responseBody: response, expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000) } });
        return response;
      }
      const purchase = await tx.compra.create({ data: {
        reservationId, customerId, eventId: reservation.eventId,
        totalCents: reservation.totalCents, currency: reservation.currency,
      }, select: { id: true, status: true } });
      await tx.compraDetalle.createMany({ data: reservation.fromReservaDetalleReservationIdEventId.map((line) => ({
        purchaseId: purchase.id, eventId: reservation.eventId, ticketTypeId: line.ticketTypeId,
        quantity: line.quantity, unitPriceCents: line.unitPriceCents, lineTotalCents: line.lineTotalCents,
      })) });
      const response = { purchaseId: purchase.id, status: purchase.status, checkoutUrl: null,
        expiresAt: reservation.expiresAt.toISOString() };
      await tx.idempotenciaSolicitud.create({ data: { userId: customerId, idempotencyKey, requestSha256,
        status: "completed", responseStatus: 201, responseBody: response, expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000) } });
      return response;
    }, { timeout: 10_000 });
  }

  async getPurchase(customerId: string, id: string) {
    const purchase = await this.database.client.compra.findFirst({ where: { id, customerId }, include: {
      refReservationIdEventIdCustomerId: { select: { expiresAt: true } },
      fromCompraDetallePurchaseIdEventId: { select: {
        ticketTypeId: true, quantity: true, unitPriceCents: true, lineTotalCents: true,
        refTicketTypeIdEventId: { select: { name: true } },
      } },
    } });
    if (!purchase) throw new NotFoundException("Compra no disponible");
    const expiresAt = purchase.refReservationIdEventIdCustomerId.expiresAt;
    return { id: purchase.id, reservationId: purchase.reservationId, eventId: purchase.eventId,
      status: purchase.status === "awaiting_payment" && expiresAt <= new Date() ? "cancelled" : purchase.status,
      expiresAt: expiresAt.toISOString(), currency: purchase.currency, totalCents: Number(purchase.totalCents),
      items: purchase.fromCompraDetallePurchaseIdEventId.map((line) => ({
        ticketTypeId: line.ticketTypeId, name: line.refTicketTypeIdEventId.name, quantity: line.quantity,
        unitPriceCents: Number(line.unitPriceCents), lineTotalCents: Number(line.lineTotalCents),
      })) };
  }
}
