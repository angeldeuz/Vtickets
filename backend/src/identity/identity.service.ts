import { ForbiddenException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import type { Principal } from "./principal";

// Perfil de negocio: se vincula al UUID de Auth y recibe CLIENTE sin confiar en user_metadata.
@Injectable()
export class IdentityService {
  constructor(private readonly database: PrismaService) {}

  async resolve(authUserId: string): Promise<Principal> {
    const client = this.database.client;
    await client.$transaction(async (tx) => {
      await tx.$executeRaw`INSERT INTO tickets_app.usuarios (auth_user_id)
        VALUES (${authUserId}::uuid) ON CONFLICT (auth_user_id) DO NOTHING`;
      const profile = await tx.usuario.findUnique({ where: { authUserId }, select: { id: true } });
      if (!profile) throw new ServiceUnavailableException("No se pudo crear el perfil");
      await tx.$executeRaw`INSERT INTO tickets_app.usuario_roles (user_id, role_id)
        SELECT ${profile.id}::uuid, id FROM tickets_app.roles WHERE code = 'CLIENTE'
        ON CONFLICT (user_id, role_id) DO NOTHING`;
    });

    const profile = await client.usuario.findUnique({
      where: { authUserId },
      select: { id: true, status: true, fromUsuarioRolUserId: { select: { refRoleId: { select: { code: true } } } } },
    });
    if (!profile || profile.fromUsuarioRolUserId.length === 0) {
      throw new ServiceUnavailableException("Perfil o roles no disponibles");
    }
    if (profile.status !== "active") throw new ForbiddenException({ code: "ACCOUNT_INACTIVE", message: "Cuenta inactiva" });
    return { authUserId, userId: profile.id, roles: profile.fromUsuarioRolUserId.map((assignment) => assignment.refRoleId.code) };
  }

  async profile(principal: Principal) {
    const profile = await this.database.client.usuario.findUniqueOrThrow({
      where: { id: principal.userId },
      select: { id: true, fullName: true, phone: true, avatarUrl: true, status: true },
    });
    return { ...profile, roles: principal.roles };
  }

  async update(principal: Principal, values: { fullName?: string | null; phone?: string | null; avatarUrl?: string | null }) {
    await this.database.client.usuario.update({ where: { id: principal.userId }, data: { ...values, updatedAt: new Date() } });
    return this.profile(principal);
  }

  async assignments(principal: Principal) {
    const now = new Date();
    const rows = await this.database.client.personalEvento.findMany({
      where: {
        userId: principal.userId,
        status: "assigned",
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gt: now } }] }],
      },
      select: { eventId: true, refRoleId: { select: { code: true } } },
    });
    return { roles: principal.roles, eventAssignments: rows.map((row) => ({ eventId: row.eventId, roleCode: row.refRoleId.code })) };
  }

  async canAccessEvent(principal: Principal, eventId: string): Promise<boolean> {
    const now = new Date();
    const count = await this.database.client.personalEvento.count({
      where: {
        userId: principal.userId, eventId, status: "assigned", refRoleId: { code: "ACCESO" },
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gt: now } }] }],
      },
    });
    return count > 0;
  }
}
