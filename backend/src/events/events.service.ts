import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import type { EventCreate, EventList, EventUpdate } from "./events.schemas";

function code(error: unknown): string | undefined {
  return error && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : undefined;
}

function invalid(message: string): never {
  throw new BadRequestException({ code: "INVALID_EVENT", message });
}

function validateDates(data: { startsAt: Date; endsAt: Date; salesStartsAt: Date | null; salesEndsAt: Date | null }): void {
  if (data.endsAt <= data.startsAt) invalid("El evento debe terminar después de comenzar");
  if (data.salesStartsAt && data.salesStartsAt >= data.startsAt) invalid("La venta debe iniciar antes del evento");
  if (data.salesEndsAt && data.salesEndsAt > data.startsAt) invalid("La venta no puede terminar después del inicio del evento");
  if (data.salesStartsAt && data.salesEndsAt && data.salesStartsAt >= data.salesEndsAt) invalid("La ventana de venta no es válida");
}

function dateFields(data: Partial<Pick<EventCreate, "startsAt" | "endsAt" | "salesStartsAt" | "salesEndsAt">>) {
  return {
    ...(data.startsAt ? { startsAt: new Date(data.startsAt) } : {}),
    ...(data.endsAt ? { endsAt: new Date(data.endsAt) } : {}),
    ...(data.salesStartsAt !== undefined ? { salesStartsAt: data.salesStartsAt ? new Date(data.salesStartsAt) : null } : {}),
    ...(data.salesEndsAt !== undefined ? { salesEndsAt: data.salesEndsAt ? new Date(data.salesEndsAt) : null } : {}),
  };
}

function stateConflict(): never {
  throw new ConflictException({ code: "INVALID_STATE_TRANSITION", message: "Transición de estado no permitida o el evento cambió" });
}

// PostgreSQL guarda microsegundos y JavaScript expone milisegundos. El rango conserva
// la precondición de edición y la versión nueva avanza al menos un milisegundo.
function versionWindow(value: Date) {
  return { gte: value, lt: new Date(value.getTime() + 1) };
}
function nextVersion(value: Date) {
  return new Date(Math.max(Date.now(), value.getTime() + 1));
}
function auditEvent(value: { title: string; slug: string; categoryId: string; venueId: string; capacityLimit: number;
  startsAt: Date; endsAt: Date; salesStartsAt: Date | null; salesEndsAt: Date | null; timezone: string }) {
  return { title: value.title, slug: value.slug, categoryId: value.categoryId, venueId: value.venueId,
    capacityLimit: value.capacityLimit, startsAt: value.startsAt.toISOString(), endsAt: value.endsAt.toISOString(),
    salesStartsAt: value.salesStartsAt?.toISOString() ?? null, salesEndsAt: value.salesEndsAt?.toISOString() ?? null,
    timezone: value.timezone };
}

// El servicio conserva las reglas comerciales; las rutas solo validan el formato de entrada.
@Injectable()
export class EventsService {
  constructor(private readonly database: PrismaService) {}

  async list(options: EventList) {
    const where = options.status ? { status: options.status } : {};
    if (options.cursor && !(await this.database.client.evento.findFirst({ where: { id: options.cursor, ...where }, select: { id: true } }))) {
      throw new BadRequestException({ code: "INVALID_CURSOR", message: "Cursor de evento no válido" });
    }
    const rows = await this.database.client.evento.findMany({
      where, orderBy: { id: "asc" }, take: options.limit + 1,
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
    });
    return { items: rows.slice(0, options.limit), nextCursor: rows.length > options.limit ? rows[options.limit - 1].id : null };
  }

  async get(id: string) {
    const event = await this.database.client.evento.findUnique({ where: { id } });
    if (!event) throw new NotFoundException("Evento no encontrado");
    return event;
  }

  async create(data: EventCreate, organizerId: string) {
    const fields = dateFields(data);
    validateDates({ startsAt: fields.startsAt!, endsAt: fields.endsAt!, salesStartsAt: fields.salesStartsAt ?? null, salesEndsAt: fields.salesEndsAt ?? null });
    await this.ensureReferences(data.categoryId, data.venueId, data.capacityLimit);
    try {
      return await this.database.client.$transaction(async (tx) => {
        const row = await tx.evento.create({ data: { ...data, ...fields, organizerId, status: "draft" } });
        await tx.auditoria.create({ data: { actorUserId: organizerId, action: "event.created", entityName: "evento", entityId: row.id,
          metadata: { title: row.title, slug: row.slug, capacityLimit: row.capacityLimit } } });
        return row;
      });
    } catch (error) {
      if (code(error) === "P2002") throw new ConflictException({ code: "EVENT_SLUG_EXISTS", message: "El slug ya está en uso" });
      if (code(error) === "P2003") invalid("Categoría, ubicación u organizador no válido");
      throw error;
    }
  }

  async update(id: string, data: EventUpdate, actorUserId?: string) {
    const current = await this.get(id);
    if (current.status !== "draft") stateConflict();
    const { updatedAt, ...changes } = data;
    const fields = dateFields(changes);
    validateDates({
      startsAt: fields.startsAt ?? current.startsAt,
      endsAt: fields.endsAt ?? current.endsAt,
      salesStartsAt: fields.salesStartsAt !== undefined ? fields.salesStartsAt : current.salesStartsAt,
      salesEndsAt: fields.salesEndsAt !== undefined ? fields.salesEndsAt : current.salesEndsAt,
    });
    if (changes.categoryId || changes.venueId || changes.capacityLimit) {
      await this.ensureReferences(changes.categoryId ?? current.categoryId, changes.venueId ?? current.venueId, changes.capacityLimit ?? current.capacityLimit);
    }
    try {
      if (changes.capacityLimit !== undefined) {
        return await this.database.client.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT id FROM tickets_app.eventos WHERE id = ${id}::uuid FOR UPDATE`;
          const allocated = await tx.tipoTicket.aggregate({ where: { eventId: id }, _sum: { quantityTotal: true } });
          if (changes.capacityLimit! < (allocated._sum.quantityTotal ?? 0)) invalid("La capacidad es menor que el stock asignado");
          const changed = await tx.evento.updateMany({
            where: { id, status: "draft", updatedAt: versionWindow(new Date(updatedAt)) },
            data: { ...changes, ...fields, updatedAt: nextVersion(current.updatedAt) },
          });
          if (changed.count !== 1) throw new ConflictException({ code: "EVENT_CHANGED", message: "El evento cambió; vuelve a cargarlo" });
          const updated = await tx.evento.findUniqueOrThrow({ where: { id } });
          if (actorUserId) await tx.auditoria.create({ data: { actorUserId, action: "event.updated", entityName: "evento", entityId: id,
            metadata: { changedFields: Object.keys(changes), before: auditEvent(current), after: auditEvent(updated) } } });
          return updated;
        });
      }
      if (actorUserId) return await this.database.client.$transaction(async (tx) => {
        const changed = await tx.evento.updateMany({
          where: { id, status: "draft", updatedAt: versionWindow(new Date(updatedAt)) },
          data: { ...changes, ...fields, updatedAt: nextVersion(current.updatedAt) },
        });
        if (changed.count !== 1) throw new ConflictException({ code: "EVENT_CHANGED", message: "El evento cambió; vuelve a cargarlo" });
        const updated = await tx.evento.findUniqueOrThrow({ where: { id } });
        await tx.auditoria.create({ data: { actorUserId, action: "event.updated", entityName: "evento", entityId: id,
          metadata: { changedFields: Object.keys(changes), before: auditEvent(current), after: auditEvent(updated) } } });
        return updated;
      });
      const changed = await this.database.client.evento.updateMany({
        where: { id, status: "draft", updatedAt: versionWindow(new Date(updatedAt)) },
        data: { ...changes, ...fields, updatedAt: nextVersion(current.updatedAt) },
      });
      if (changed.count !== 1) throw new ConflictException({ code: "EVENT_CHANGED", message: "El evento cambió; vuelve a cargarlo" });
      return this.get(id);
    } catch (error) {
      if (code(error) === "P2002") throw new ConflictException({ code: "EVENT_SLUG_EXISTS", message: "El slug ya está en uso" });
      if (code(error) === "P2003") invalid("Categoría o ubicación no válida");
      throw error;
    }
  }

  async publish(id: string, actorUserId?: string) { return this.transition(id, "draft", "published", true, { actorUserId }); }
  async suspend(id: string, input: { reason: string }, actorUserId: string) {
    return this.transition(id, "published", "suspended", false, { reason: input.reason, actorUserId });
  }
  async resume(id: string, actorUserId?: string) { return this.transition(id, "suspended", "published", true, { actorUserId }); }

  private async transition(id: string, from: string, to: string, checkReadiness: boolean, audit?: { reason?: string; actorUserId?: string }) {
    return this.database.client.$transaction(async (tx) => {
      // Todas las mutaciones de boletos bloquean primero el evento. Leer la preparación
      // después de este bloqueo evita publicar con un estado de boletos ya obsoleto.
      const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM tickets_app.eventos WHERE id = ${id}::uuid FOR UPDATE`;
      if (!locked.length) throw new NotFoundException("Evento no encontrado");
      const event = await tx.evento.findUnique({
        where: { id },
        include: { refCategoryId: true, refVenueId: true, fromTipoTicketEventId: true },
      });
      if (!event) throw new NotFoundException("Evento no encontrado");
      if (event.status !== from) stateConflict();
      if (checkReadiness) {
        validateDates(event);
        if (event.startsAt <= new Date()) invalid("Solo se puede publicar un evento futuro");
        if (!event.refCategoryId.isActive) invalid("La categoría debe estar activa");
        if (event.refVenueId.capacity !== null && event.capacityLimit > event.refVenueId.capacity) invalid("La capacidad supera la del recinto");
        const tickets = event.fromTipoTicketEventId.filter((ticket) => ticket.status === "active" && ticket.quantityTotal > 0);
        if (!tickets.length) invalid("Agrega al menos un tipo de boleto activo con inventario antes de publicar");
        for (const ticket of tickets) {
          const starts = ticket.salesStartsAt ?? event.salesStartsAt;
          const ends = ticket.salesEndsAt ?? event.salesEndsAt ?? event.startsAt;
          if (starts && starts >= ends) invalid("La ventana de venta de un boleto no es válida");
          if (ends > event.startsAt) invalid("La venta de un boleto termina después del inicio del evento");
        }
      }
      const changed = await tx.evento.updateMany({
        where: { id, status: from, updatedAt: versionWindow(event.updatedAt) },
        data: { status: to, updatedAt: nextVersion(event.updatedAt) },
      });
      if (changed.count !== 1) stateConflict();
      if (audit?.actorUserId) await tx.auditoria.create({ data: {
        actorUserId: audit.actorUserId, action: `event.${to}`, entityName: "evento", entityId: id,
        metadata: { from, to, ...(audit.reason ? { reason: audit.reason } : {}) },
      } });
      return tx.evento.findUniqueOrThrow({ where: { id } });
    });
  }

  private async ensureReferences(categoryId: string, venueId: string, capacityLimit: number) {
    const [category, venue] = await Promise.all([
      this.database.client.categoria.findUnique({ where: { id: categoryId }, select: { id: true, isActive: true } }),
      this.database.client.ubicacion.findUnique({ where: { id: venueId }, select: { id: true, capacity: true } }),
    ]);
    if (!category || !category.isActive) invalid("Selecciona una categoría activa");
    if (!venue) invalid("Selecciona una ubicación válida");
    if (venue.capacity !== null && capacityLimit > venue.capacity) invalid("La capacidad supera la del recinto");
  }
}
