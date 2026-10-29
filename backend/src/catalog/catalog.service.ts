import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import type { CategoryCreate, CategoryUpdate, ListOptions, VenueCreate, VenueUpdate } from "./catalog.schemas";

function databaseErrorCode(error: unknown): string | undefined {
  return error && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : undefined;
}

// El catálogo usa las tablas existentes de tickets_app; el navegador nunca escribe en Supabase directamente.
@Injectable()
export class CatalogService {
  constructor(private readonly database: PrismaService) {}

  async publicCategories() {
    return this.database.client.categoria.findMany({
      where: { isActive: true },
      select: { id: true, name: true, slug: true, description: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    });
  }

  async categories(options: ListOptions) {
    if (options.cursor && !(await this.database.client.categoria.findUnique({ where: { id: options.cursor }, select: { id: true } }))) {
      throw new BadRequestException({ code: "INVALID_CURSOR", message: "Cursor de categoría no válido" });
    }
    const rows = await this.database.client.categoria.findMany({
      orderBy: { id: "asc" },
      take: options.limit + 1,
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
    });
    return { items: rows.slice(0, options.limit), nextCursor: rows.length > options.limit ? rows[options.limit - 1].id : null };
  }

  async createCategory(data: CategoryCreate) {
    try {
      return await this.database.client.categoria.create({ data });
    } catch (error) {
      if (databaseErrorCode(error) === "P2002") throw new ConflictException({ code: "CATEGORY_SLUG_EXISTS", message: "El slug ya está en uso" });
      throw error;
    }
  }

  async updateCategory(id: string, data: CategoryUpdate) {
    try {
      return await this.database.client.categoria.update({ where: { id }, data: { ...data, updatedAt: new Date() } });
    } catch (error) {
      if (databaseErrorCode(error) === "P2025") throw new NotFoundException("Categoría no encontrada");
      if (databaseErrorCode(error) === "P2002") throw new ConflictException({ code: "CATEGORY_SLUG_EXISTS", message: "El slug ya está en uso" });
      throw error;
    }
  }

  async venues(options: ListOptions) {
    if (options.cursor && !(await this.database.client.ubicacion.findUnique({ where: { id: options.cursor }, select: { id: true } }))) {
      throw new BadRequestException({ code: "INVALID_CURSOR", message: "Cursor de ubicación no válido" });
    }
    const rows = await this.database.client.ubicacion.findMany({
      orderBy: { id: "asc" },
      take: options.limit + 1,
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
    });
    return { items: rows.slice(0, options.limit), nextCursor: rows.length > options.limit ? rows[options.limit - 1].id : null };
  }

  createVenue(data: VenueCreate) {
    return this.database.client.ubicacion.create({ data });
  }

  async updateVenue(id: string, data: VenueUpdate) {
    try {
      return await this.database.client.ubicacion.update({ where: { id }, data: { ...data, updatedAt: new Date() } });
    } catch (error) {
      if (databaseErrorCode(error) === "P2025") throw new NotFoundException("Ubicación no encontrada");
      throw error;
    }
  }
}
