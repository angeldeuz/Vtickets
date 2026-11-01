import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { AuthGuard } from "../identity/auth.guard";
import { RequireRoles, RolesGuard } from "../identity/roles.guard";
import type { AuthenticatedRequest } from "../identity/principal";
import { CatalogService } from "./catalog.service";
import { validateInput } from "../common/validate-input";
import { categoryCreateSchema, categoryUpdateSchema, idSchema, listSchema, venueCreateSchema, venueUpdateSchema } from "./catalog.schemas";

function validate<T extends z.ZodType>(schema: T, value: unknown): z.output<T> {
  return validateInput(schema, value, "Revisa los datos del catálogo");
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
  createCategory(@Req() request: AuthenticatedRequest, @Body() body: unknown) { return this.catalog.createCategory(validate(categoryCreateSchema, body), request.principal!.userId); }

  @Patch("categories/:id")
  @ApiOperation({ summary: "Actualiza una categoría" })
  updateCategory(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body() body: unknown) {
    return this.catalog.updateCategory(validate(idSchema, id), validate(categoryUpdateSchema, body), request.principal!.userId);
  }

  @Get("venues")
  @ApiOperation({ summary: "Lista ubicaciones para administración" })
  venues(@Query() query: unknown) { return this.catalog.venues(validate(listSchema, query)); }

  @Post("venues")
  @ApiOperation({ summary: "Crea una ubicación" })
  createVenue(@Req() request: AuthenticatedRequest, @Body() body: unknown) { return this.catalog.createVenue(validate(venueCreateSchema, body), request.principal!.userId); }

  @Patch("venues/:id")
  @ApiOperation({ summary: "Actualiza una ubicación" })
  updateVenue(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body() body: unknown) {
    return this.catalog.updateVenue(validate(idSchema, id), validate(venueUpdateSchema, body), request.principal!.userId);
  }
}
