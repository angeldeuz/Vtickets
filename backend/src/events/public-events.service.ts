import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { z } from "zod";
import { PrismaService } from "../database/prisma.service";
import { StorageService } from "./storage.service";
import type { Prisma } from "../../generated/prisma/client";
import type { PublicEventList } from "./public-events.schemas";

const relations = {
  refCategoryId: { select: { name: true } },
  refVenueId: { select: { name: true, addressLine1: true, city: true, region: true } },
  fromTipoTicketEventId: {
    where: { status: "active" },
    select: { id: true, name: true, description: true, priceCents: true, currency: true,
      quantityTotal: true, maxPerOrder: true, maxPerUser: true, salesStartsAt: true, salesEndsAt: true,
      fromInventarioTicketTypeId: { select: { reservedCount: true, soldCount: true } } },
    orderBy: { priceCents: "asc" },
  },
  fromEventoImagenEventId: {
    select: { id: true, altText: true, isCover: true, sortOrder: true },
    orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
  },
} satisfies Prisma.EventoInclude;

type PublicEventRow = Prisma.EventoGetPayload<{ include: typeof relations }>;

const cursorSchema = z.strictObject({
  version: z.literal(1),
  startsAt: z.iso.datetime(),
  id: z.uuid(),
  filters: z.strictObject({ limit: z.number().int(), city: z.string().nullable(), category: z.string().nullable(), from: z.string().nullable(), q: z.string().nullable() }),
});

function filtersOf(query: PublicEventList) {
  return { limit: query.limit, city: query.city ?? null, category: query.category ?? null, from: query.from ?? null, q: query.q ?? null };
}

function decodeCursor(value: string, query: PublicEventList) {
  try {
    const cursor = cursorSchema.parse(JSON.parse(Buffer.from(value, "base64url").toString("utf8")));
    if (JSON.stringify(cursor.filters) !== JSON.stringify(filtersOf(query))) throw new Error("Filtros incompatibles");
    return cursor;
  } catch {
    throw new BadRequestException("Cursor de eventos no válido para estos filtros");
  }
}

// Recorrido público: Next.js llama al controlador, este servicio lee PostgreSQL
// con Prisma y devuelve solo campos de catálogo. Nunca expone rutas de Storage.
@Injectable()
export class PublicEventsService {
  constructor(private readonly database: PrismaService, private readonly storage: StorageService) {}

  async list(query: PublicEventList) {
    const cursor = query.cursor ? decodeCursor(query.cursor, query) : null;
    const from = query.from ? new Date(query.from) : null;
    // Cada página vuelve a excluir eventos que ya empezaron; el cursor solo fija el orden.
    const now = new Date(Date.now());
    const threshold = from && from > now ? from : now;
    const where: Prisma.EventoWhereInput = {
      status: "published", startsAt: { gt: threshold },
      AND: [
        ...(query.city ? [{ refVenueId: { is: { city: query.city } } }] : []),
        ...(query.category ? [{ refCategoryId: { is: { name: query.category } } }] : []),
        ...(query.q ? [{ OR: [
          { title: { contains: query.q, mode: "insensitive" as const } },
          { summary: { contains: query.q, mode: "insensitive" as const } },
          { refVenueId: { is: { OR: [
            { name: { contains: query.q, mode: "insensitive" as const } },
            { city: { contains: query.q, mode: "insensitive" as const } },
          ] } } },
        ] }] : []),
        ...(cursor ? [{ OR: [
          { startsAt: { gt: new Date(cursor.startsAt) } },
          { startsAt: new Date(cursor.startsAt), id: { gt: cursor.id } },
        ] }] : []),
      ],
    };
    const rows = await this.database.client.evento.findMany({
      where,
      include: relations,
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
      take: query.limit + 1,
    });
    const items = rows.slice(0, query.limit);
    const last = items.at(-1);
    const nextCursor = rows.length > query.limit && last ? Buffer.from(JSON.stringify({
      version: 1, startsAt: last.startsAt.toISOString(), id: last.id, filters: filtersOf(query),
    })).toString("base64url") : null;
    const held = await this.liveReservations(items, now);
    return { items: items.map((row) => this.present(row, held)), nextCursor };
  }

  async get(slug: string) {
    const row = await this.database.client.evento.findFirst({
      where: { slug, status: "published" }, include: relations,
    });
    if (!row) throw new NotFoundException("Evento no disponible");
    return this.present(row, await this.liveReservations([row], new Date()));
  }

  async cover(slug: string) {
    const row = await this.database.client.evento.findFirst({
      where: { slug, status: "published" },
      select: { fromEventoImagenEventId: { where: { isCover: true }, select: { storagePath: true }, take: 1 } },
    });
    const cover = row?.fromEventoImagenEventId[0];
    if (!cover) throw new NotFoundException("Imagen no disponible");
    return this.storage.download(cover.storagePath);
  }

  // El contador se libera por el worker, pero el catálogo descuenta solamente reservas vigentes.
  // Así un worker detenido no mantiene artificialmente agotada una entrada vencida.
  private async liveReservations(rows: PublicEventRow[], now: Date): Promise<Map<string, number>> {
    const ids = rows.flatMap((row) => row.fromTipoTicketEventId.map((ticket) => ticket.id));
    if (!ids.length) return new Map();
    const details = await this.database.client.reservaDetalle.findMany({
      where: { ticketTypeId: { in: ids }, refReservationIdEventId: { status: "active", expiresAt: { gt: now } } },
      select: { ticketTypeId: true, quantity: true },
    });
    const held = new Map<string, number>();
    for (const detail of details) held.set(detail.ticketTypeId, (held.get(detail.ticketTypeId) ?? 0) + detail.quantity);
    return held;
  }

  private present(row: PublicEventRow, held: Map<string, number>) {
    const now = Date.now();
    const tickets = row.fromTipoTicketEventId.map((ticket) => {
      const available = Math.max(0, ticket.quantityTotal - (held.get(ticket.id) ?? 0) - (ticket.fromInventarioTicketTypeId?.soldCount ?? 0));
      const start = ticket.salesStartsAt ?? row.salesStartsAt;
      const end = ticket.salesEndsAt ?? row.salesEndsAt ?? row.startsAt;
      const saleStatus = now >= row.startsAt.getTime() || now >= end.getTime() ? "closed"
        : start && now < start.getTime() ? "upcoming"
        : available === 0 ? "sold_out" : "available";
      return { id: ticket.id, name: ticket.name, description: ticket.description,
        price: Number(ticket.priceCents) / 100, currency: ticket.currency, available,
        maxPerOrder: ticket.maxPerOrder, maxPerUser: ticket.maxPerUser, saleStatus };
    });
    const cover = row.fromEventoImagenEventId.find((image) => image.isCover);
    return { id: row.id, slug: row.slug, title: row.title, summary: row.summary,
      description: row.description, category: row.refCategoryId.name,
      startsAt: row.startsAt.toISOString(), timezone: row.timezone,
      venue: row.refVenueId.name, address: row.refVenueId.addressLine1,
      city: row.refVenueId.city, region: row.refVenueId.region,
      cover: cover ? { alt: cover.altText ?? row.title } : null,
      tickets };
  }
}
