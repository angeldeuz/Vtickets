import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import type { StaffCreate, StaffUpdate } from "./event-staff.schemas";

function windowValid(startsAt: Date | null, endsAt: Date | null) {
  if (startsAt && endsAt && endsAt <= startsAt) throw new BadRequestException({ code: "INVALID_STAFF_WINDOW", message: "La vigencia debe terminar después de iniciar" });
}
const date = (value: string | null | undefined) => value ? new Date(value) : null;

@Injectable()
export class EventStaffService {
  constructor(private readonly database: PrismaService) {}

  async list(eventId: string) {
    if (!await this.database.client.evento.findUnique({ where: { id: eventId }, select: { id: true } })) throw new NotFoundException("Evento no encontrado");
    return this.database.client.personalEvento.findMany({ where: { eventId }, orderBy: { assignedAt: "desc" },
      select: { id: true, eventId: true, userId: true, status: true, assignedAt: true, startsAt: true, endsAt: true,
        refUserId: { select: { fullName: true, phone: true } } } });
  }

  async create(eventId: string, input: StaffCreate, actorUserId: string) {
    const startsAt = date(input.startsAt), endsAt = date(input.endsAt);
    windowValid(startsAt, endsAt);
    try {
      return await this.database.client.$transaction(async (tx) => {
        const [event, user, role] = await Promise.all([
          tx.evento.findUnique({ where: { id: eventId }, select: { status: true } }),
          tx.usuario.findUnique({ where: { id: input.userId }, select: { status: true } }),
          tx.rol.findUnique({ where: { code: "ACCESO" }, select: { id: true } }),
        ]);
        if (!event) throw new NotFoundException("Evento no encontrado");
        if (!["draft", "published", "suspended"].includes(event.status)) throw new ConflictException({ code: "EVENT_NOT_ASSIGNABLE", message: "El evento no admite personal" });
        if (!user || user.status !== "active") throw new BadRequestException({ code: "INVALID_STAFF_USER", message: "El usuario debe estar activo" });
        if (!role) throw new BadRequestException({ code: "ACCESS_ROLE_MISSING", message: "Falta el rol de acceso" });
        const existing = await tx.personalEvento.findUnique({ where: { eventId_userId_roleId: { eventId, userId: input.userId, roleId: role.id } } });
        if (existing) throw new ConflictException({ code: "STAFF_ASSIGNMENT_EXISTS", message: "Ya existe una asignación; edítala para reactivarla" });
        const row = await tx.personalEvento.create({ data: { eventId, userId: input.userId, roleId: role.id,
          status: "assigned", assignedBy: actorUserId, startsAt, endsAt } });
        await tx.auditoria.create({ data: { actorUserId, action: "staff.assigned", entityName: "personal_evento", entityId: row.id,
          metadata: { eventId, userId: input.userId, roleCode: "ACCESO", startsAt, endsAt } } });
        return row;
      });
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
        throw new ConflictException({ code: "STAFF_ASSIGNMENT_EXISTS", message: "Ya existe una asignación" });
      }
      throw error;
    }
  }

  async update(eventId: string, id: string, input: StaffUpdate, actorUserId: string) {
    return this.database.client.$transaction(async (tx) => {
      const current = await tx.personalEvento.findFirst({ where: { id, eventId } });
      if (!current) throw new NotFoundException("Asignación no encontrada");
      const startsAt = input.startsAt !== undefined ? date(input.startsAt) : current.startsAt;
      const endsAt = input.endsAt !== undefined ? date(input.endsAt) : current.endsAt;
      windowValid(startsAt, endsAt);
      if (input.status === "assigned") {
        const event = await tx.evento.findUnique({ where: { id: eventId }, select: { status: true } });
        if (!event || !["draft", "published", "suspended"].includes(event.status)) {
          throw new ConflictException({ code: "EVENT_NOT_ASSIGNABLE", message: "El evento no admite personal" });
        }
        const user = await tx.usuario.findUnique({ where: { id: current.userId }, select: { status: true } });
        if (user?.status !== "active") throw new BadRequestException({ code: "INVALID_STAFF_USER", message: "El usuario debe estar activo" });
      }
      const row = await tx.personalEvento.update({ where: { id }, data: { status: input.status, startsAt, endsAt } });
      await tx.auditoria.create({ data: { actorUserId, action: input.status === "withdrawn" ? "staff.withdrawn" : "staff.updated",
        entityName: "personal_evento", entityId: id,
        metadata: { eventId, userId: current.userId, before: { status: current.status, startsAt: current.startsAt, endsAt: current.endsAt },
          after: { status: row.status, startsAt: row.startsAt, endsAt: row.endsAt } } } });
      return row;
    });
  }
}
