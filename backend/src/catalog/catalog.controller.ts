import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { AuthGuard } from "../identity/auth.guard";
import { RequireRoles, RolesGuard } from "../identity/roles.guard";
import { CatalogService } from "./catalog.service";
import { categoryCreateSchema, categoryUpdateSchema, idSchema, listSchema, venueCreateSchema, venueUpdateSchema } from "./catalog.schemas";

function validate<T extends z.ZodType>(schema: T, value: unknown): z.output<T> {
  const result = schema.safeParse(value);
  if (!result.success) throw new BadRequestException({ code: "VALIDATION_ERROR", message: "Datos del catálogo no válidos" });
  return result.data;
}

@ApiTags("catalog")
@Controller("categories")
export class PublicCategoriesController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  @ApiOperation({ summary: "Lista categorías activas para el catálogo público" })
  list() { return this.catalog.publicCategories(); }
}

// AuthGuard resuelve la identidad y RolesGuard exige el rol actual del perfil de negocio.
@ApiTags("admin-catalog")
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@RequireRoles("ADMINISTRADOR")
@Controller("admin")
export class AdminCatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get("categories")
  @ApiOperation({ summary: "Lista categorías para administración" })
  categories(@Query() query: unknown) { return this.catalog.categories(validate(listSchema, query)); }

  @Post("categories")
  @ApiOperation({ summary: "Crea una categoría" })
  createCategory(@Body() body: unknown) { return this.catalog.createCategory(validate(categoryCreateSchema, body)); }

  @Patch("categories/:id")
  @ApiOperation({ summary: "Actualiza una categoría" })
  updateCategory(@Param("id") id: string, @Body() body: unknown) {
    return this.catalog.updateCategory(validate(idSchema, id), validate(categoryUpdateSchema, body));
  }

  @Get("venues")
  @ApiOperation({ summary: "Lista ubicaciones para administración" })
  venues(@Query() query: unknown) { return this.catalog.venues(validate(listSchema, query)); }

  @Post("venues")
  @ApiOperation({ summary: "Crea una ubicación" })
  createVenue(@Body() body: unknown) { return this.catalog.createVenue(validate(venueCreateSchema, body)); }

  @Patch("venues/:id")
  @ApiOperation({ summary: "Actualiza una ubicación" })
  updateVenue(@Param("id") id: string, @Body() body: unknown) {
    return this.catalog.updateVenue(validate(idSchema, id), validate(venueUpdateSchema, body));
  }
}
