import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import type { TicketTypeCreate, TicketTypeUpdate } from "./ticket-types.schemas";

function invalid(message: string): never {
  throw new BadRequestException({ code: "INVALID_TICKET_TYPE", message });
}
function conflict(): never {
  throw new ConflictException({ code: "TICKET_TYPE_CHANGED", message: "El tipo de boleto cambió; vuelve a cargarlo" });
}
function errorCode(error: unknown): string | undefined {
  return error && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : undefined;
}
function dates(input: { salesStartsAt?: string | null; salesEndsAt?: string | null }) {
  return {
    ...(input.salesStartsAt !== undefined ? { salesStartsAt: input.salesStartsAt ? new Date(input.salesStartsAt) : null } : {}),
    ...(input.salesEndsAt !== undefined ? { salesEndsAt: input.salesEndsAt ? new Date(input.salesEndsAt) : null } : {}),
  };
}
function response<T extends { priceCents: bigint; fromInventarioTicketTypeId?: { reservedCount: number; soldCount: number } | null }>(row: T) {
  const { fromInventarioTicketTypeId, ...rest } = row;
  return { ...rest, priceCents: Number(row.priceCents), inventory: fromInventarioTicketTypeId ?? null };
}
function auditTicket(value: { name: string; description: string | null; priceCents: bigint; quantityTotal: number;
  maxPerOrder: number; maxPerUser: number; status: string; salesStartsAt: Date | null; salesEndsAt: Date | null }) {
  return { name: value.name, description: value.description, priceCents: Number(value.priceCents),
    quantityTotal: value.quantityTotal, maxPerOrder: value.maxPerOrder, maxPerUser: value.maxPerUser,
    status: value.status, salesStartsAt: value.salesStartsAt?.toISOString() ?? null,
    salesEndsAt: value.salesEndsAt?.toISOString() ?? null };
}

// Bloquear el evento serializa cambios de tipos y permite comprobar la capacidad total.
// La misma transacción crea tipo e inventario: nunca queda un tipo sin contador.
@Injectable()
export class TicketTypesService {
  constructor(private readonly database: PrismaService) {}

  async list(eventId: string) {
    const event = await this.database.client.evento.findUnique({ where: { id: eventId }, select: { id: true } });
    if (!event) throw new NotFoundException("Evento no encontrado");
    const rows = await this.database.client.tipoTicket.findMany({
      where: { eventId }, include: { fromInventarioTicketTypeId: true }, orderBy: { createdAt: "asc" },
    });
    return rows.map(response);
  }

  async create(eventId: string, input: TicketTypeCreate, actorUserId?: string) {
    try {
      return await this.database.client.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM tickets_app.eventos WHERE id = ${eventId}::uuid FOR UPDATE`;
        const event = await tx.evento.findUnique({ where: { id: eventId }, select: {
          status: true, startsAt: true, salesStartsAt: true, salesEndsAt: true, capacityLimit: true,
        } });
        if (!event) throw new NotFoundException("Evento no encontrado");
        if (event.status !== "draft") conflict();
        this.checkWindow(event, dates(input));
        const allocated = await tx.tipoTicket.aggregate({ where: { eventId }, _sum: { quantityTotal: true } });
        if ((allocated._sum.quantityTotal ?? 0) + input.quantityTotal > event.capacityLimit) invalid("La suma de boletos supera la capacidad del evento");
        const row = await tx.tipoTicket.create({ data: {
          ...input, ...dates(input), eventId, priceCents: BigInt(input.priceCents),
          fromInventarioTicketTypeId: { create: {} },
        }, include: { fromInventarioTicketTypeId: true } });
        if (actorUserId) await tx.auditoria.create({ data: { actorUserId, action: "ticket_type.created", entityName: "tipo_ticket", entityId: row.id,
          metadata: { eventId, name: row.name, priceCents: input.priceCents, quantityTotal: row.quantityTotal } } });
        return response(row);
      });
    } catch (error) {
      if (errorCode(error) === "P2002") throw new ConflictException({ code: "TICKET_TYPE_NAME_EXISTS", message: "Ya existe un tipo con ese nombre en el evento" });
      throw error;
    }
  }

  async update(id: string, input: TicketTypeUpdate, actorUserId?: string) {
    try {
      return await this.database.client.$transaction(async (tx) => {
        const lookup = await tx.tipoTicket.findUnique({ where: { id }, select: { eventId: true } });
        if (!lookup) throw new NotFoundException("Tipo de boleto no encontrado");
        await tx.$queryRaw`SELECT id FROM tickets_app.eventos WHERE id = ${lookup.eventId}::uuid FOR UPDATE`;
        const current = await tx.tipoTicket.findUniqueOrThrow({ where: { id }, include: { fromInventarioTicketTypeId: true } });
        const event = await tx.evento.findUniqueOrThrow({ where: { id: lookup.eventId }, select: {
          status: true, startsAt: true, salesStartsAt: true, salesEndsAt: true, capacityLimit: true,
        } });
        if (!["draft", "published", "suspended"].includes(event.status)) conflict();
        const { updatedAt, ...changes } = input;
        // Tras publicar, solo se puede ajustar stock o pausar/reanudar ventas.
        // El precio y las condiciones anunciadas permanecen estables.
        if (event.status !== "draft" && Object.keys(changes).some((key) => !["quantityTotal", "status"].includes(key))) conflict();
        const fields = dates(changes);
        this.checkWindow(event, {
          salesStartsAt: fields.salesStartsAt !== undefined ? fields.salesStartsAt : current.salesStartsAt,
          salesEndsAt: fields.salesEndsAt !== undefined ? fields.salesEndsAt : current.salesEndsAt,
        });
        if (changes.quantityTotal !== undefined) {
          await tx.$queryRaw`SELECT ticket_type_id FROM tickets_app.inventarios WHERE ticket_type_id = ${id}::uuid FOR UPDATE`;
          const inventory = await tx.inventario.findUnique({ where: { ticketTypeId: id } });
          if (!inventory) invalid("Falta el inventario del tipo de boleto");
          const committed = inventory.reservedCount + inventory.soldCount;
          if (changes.quantityTotal < committed) invalid("El stock es menor que las entradas comprometidas");
          const allocated = await tx.tipoTicket.aggregate({ where: { eventId: lookup.eventId }, _sum: { quantityTotal: true } });
          if ((allocated._sum.quantityTotal ?? 0) - current.quantityTotal + changes.quantityTotal > event.capacityLimit) invalid("La suma de boletos supera la capacidad del evento");
        }
        const expected = new Date(updatedAt);
        const changed = await tx.tipoTicket.updateMany({
          where: { id, updatedAt: { gte: expected, lt: new Date(expected.getTime() + 1) } },
          data: { ...changes, ...fields, ...(changes.priceCents !== undefined ? { priceCents: BigInt(changes.priceCents) } : {}),
            updatedAt: new Date(Math.max(Date.now(), current.updatedAt.getTime() + 1)) },
        });
        if (changed.count !== 1) conflict();
        const updated = await tx.tipoTicket.findUniqueOrThrow({ where: { id }, include: { fromInventarioTicketTypeId: true } });
        if (actorUserId) await tx.auditoria.create({ data: { actorUserId, action: "ticket_type.updated", entityName: "tipo_ticket", entityId: id,
          metadata: { eventId: lookup.eventId, changedFields: Object.keys(changes), before: auditTicket(current), after: auditTicket(updated) } } });
        return response(updated);
      });
    } catch (error) {
      if (errorCode(error) === "P2002") throw new ConflictException({ code: "TICKET_TYPE_NAME_EXISTS", message: "Ya existe un tipo con ese nombre en el evento" });
      throw error;
    }
  }

  private checkWindow(event: { startsAt: Date; salesStartsAt: Date | null; salesEndsAt: Date | null }, ticket: { salesStartsAt?: Date | null; salesEndsAt?: Date | null }) {
    const start = ticket.salesStartsAt ?? event.salesStartsAt;
    const end = ticket.salesEndsAt ?? event.salesEndsAt ?? event.startsAt;
    if (start && start >= end) invalid("La ventana de venta no es válida");
    if (end > event.startsAt) invalid("La venta termina después del inicio del evento");
    if (ticket.salesStartsAt && event.salesStartsAt && ticket.salesStartsAt < event.salesStartsAt) invalid("La venta del boleto inicia antes de la del evento");
    if (ticket.salesEndsAt && event.salesEndsAt && ticket.salesEndsAt > event.salesEndsAt) invalid("La venta del boleto termina después de la del evento");
  }
}
