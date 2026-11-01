import { Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";

@Injectable()
export class AdminUsersService {
  constructor(private readonly database: PrismaService) {}
  list(q?: string) {
    return this.database.client.usuario.findMany({ where: { status: "active", ...(q ? { fullName: { contains: q, mode: "insensitive" } as const } : {}) },
      select: { id: true, fullName: true, phone: true, createdAt: true }, orderBy: [{ fullName: "asc" }, { id: "asc" }], take: 100 });
  }
}
