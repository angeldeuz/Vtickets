import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import type { AuditQuery } from "./audit.controller";

@Injectable()
export class AuditService {
  constructor(private readonly database: PrismaService) {}

  async list(query: AuditQuery) {
    if (query.from && query.to && new Date(query.from) > new Date(query.to)) {
      throw new BadRequestException({ code: "INVALID_AUDIT_RANGE", message: "La fecha inicial supera la final" });
    }
    const where = {
      ...(query.actorUserId ? { actorUserId: query.actorUserId } : {}),
      ...(query.entityName ? { entityName: query.entityName } : {}),
      ...((query.from || query.to) ? { createdAt: {
        ...(query.from ? { gte: new Date(query.from) } : {}), ...(query.to ? { lte: new Date(query.to) } : {}),
      } } : {}),
    };
    if (query.cursor && !await this.database.client.auditoria.findFirst({ where: { ...where, id: query.cursor }, select: { id: true } })) {
      throw new BadRequestException({ code: "INVALID_CURSOR", message: "Cursor de auditoría no válido" });
    }
    const rows = await this.database.client.auditoria.findMany({
      where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      include: { refActorUserId: { select: { fullName: true } } },
    });
    const items = rows.slice(0, query.limit);
    const subjectIds = [...new Set(items.map((row) => {
      const metadata = row.metadata;
      return metadata && typeof metadata === "object" && !Array.isArray(metadata) && "userId" in metadata && typeof metadata.userId === "string"
        ? metadata.userId : null;
    }).filter((value): value is string => Boolean(value)))];
    const subjects = subjectIds.length ? await this.database.client.usuario.findMany({
      where: { id: { in: subjectIds } }, select: { id: true, fullName: true },
    }) : [];
    const names = new Map(subjects.map((user) => [user.id, user.fullName]));
    const eventIds = [...new Set(items.map((row) => {
      const metadata = row.metadata;
      const linked = metadata && typeof metadata === "object" && !Array.isArray(metadata) && "eventId" in metadata && typeof metadata.eventId === "string"
        ? metadata.eventId : null;
      return row.entityName === "evento" ? row.entityId : linked;
    }).filter((value): value is string => Boolean(value)))];
    const ticketIds = items.filter((row) => row.entityName === "tipo_ticket" && row.entityId).map((row) => row.entityId!);
    const [events, tickets] = await Promise.all([
      eventIds.length ? this.database.client.evento.findMany({ where: { id: { in: eventIds } }, select: { id: true, title: true } }) : Promise.resolve([]),
      ticketIds.length ? this.database.client.tipoTicket.findMany({ where: { id: { in: ticketIds } }, select: { id: true, name: true } }) : Promise.resolve([]),
    ]);
    const eventTitles = new Map(events.map((event) => [event.id, event.title]));
    const ticketNames = new Map(tickets.map((ticket) => [ticket.id, ticket.name]));
    return { items: items.map((row) => {
      const metadata = row.metadata;
      const subjectId = metadata && typeof metadata === "object" && !Array.isArray(metadata) && "userId" in metadata && typeof metadata.userId === "string"
        ? metadata.userId : null;
      const linkedEventId = metadata && typeof metadata === "object" && !Array.isArray(metadata) && "eventId" in metadata && typeof metadata.eventId === "string"
        ? metadata.eventId : null;
      return { ...row, subjectName: subjectId ? names.get(subjectId) ?? null : null,
        eventTitle: eventTitles.get(row.entityName === "evento" ? row.entityId ?? "" : linkedEventId ?? "") ?? null,
        ticketName: row.entityName === "tipo_ticket" ? ticketNames.get(row.entityId ?? "") ?? null : null };
    }), nextCursor: rows.length > query.limit ? rows[query.limit - 1].id : null };
  }
}
