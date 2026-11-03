import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { StorageService } from "./storage.service";
import type { Prisma } from "../../generated/prisma/client";

const relations = {
  refCategoryId: { select: { name: true } },
  refVenueId: { select: { name: true, addressLine1: true, city: true, region: true } },
  fromTipoTicketEventId: {
    where: { status: "active" },
    select: { id: true, name: true, description: true, priceCents: true, currency: true,
      quantityTotal: true, salesStartsAt: true, salesEndsAt: true,
      fromInventarioTicketTypeId: { select: { reservedCount: true, soldCount: true } } },
    orderBy: { priceCents: "asc" },
  },
  fromEventoImagenEventId: {
    select: { id: true, altText: true, isCover: true, sortOrder: true },
    orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
  },
} satisfies Prisma.EventoInclude;

type PublicEventRow = Prisma.EventoGetPayload<{ include: typeof relations }>;

// Recorrido público: Next.js llama al controlador, este servicio lee PostgreSQL
// con Prisma y devuelve solo campos de catálogo. Nunca expone rutas de Storage.
@Injectable()
export class PublicEventsService {
  constructor(private readonly database: PrismaService, private readonly storage: StorageService) {}

  async list() {
    const rows = await this.database.client.evento.findMany({
      where: { status: "published", startsAt: { gt: new Date() } },
      include: relations,
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
    });
    return rows.map((row) => this.present(row));
  }

  async get(slug: string) {
    const row = await this.database.client.evento.findFirst({
      where: { slug, status: "published" }, include: relations,
    });
    if (!row) throw new NotFoundException("Evento no disponible");
    return this.present(row);
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

  private present(row: PublicEventRow) {
    const now = Date.now();
    const tickets = row.fromTipoTicketEventId.map((ticket) => {
      const available = Math.max(0, ticket.quantityTotal - (ticket.fromInventarioTicketTypeId?.reservedCount ?? 0) - (ticket.fromInventarioTicketTypeId?.soldCount ?? 0));
      const start = ticket.salesStartsAt ?? row.salesStartsAt;
      const end = ticket.salesEndsAt ?? row.salesEndsAt ?? row.startsAt;
      const saleStatus = now >= row.startsAt.getTime() || now >= end.getTime() ? "closed"
        : start && now < start.getTime() ? "upcoming"
        : available === 0 ? "sold_out" : "available";
      return { id: ticket.id, name: ticket.name, description: ticket.description,
        price: Number(ticket.priceCents) / 100, currency: ticket.currency, available, saleStatus };
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
