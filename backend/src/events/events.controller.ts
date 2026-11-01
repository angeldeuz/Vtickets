import { BadRequestException, Body, Controller, Get, HttpCode, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { AuthGuard } from "../identity/auth.guard";
import type { AuthenticatedRequest } from "../identity/principal";
import { RequireRoles, RolesGuard } from "../identity/roles.guard";
import { EventsService } from "./events.service";
import { emptyBodySchema, eventCreateSchema, eventIdSchema, eventListSchema, eventSuspendSchema, eventUpdateSchema } from "./events.schemas";

function validate<T extends z.ZodType>(schema: T, value: unknown): z.output<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    const fields: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const field = String(issue.path[0] ?? "");
      if (field && !fields[field]) fields[field] = issue.message;
    }
    throw new BadRequestException({ code: "VALIDATION_ERROR", message: "Revisa los campos marcados", details: { fields } });
  }
  return result.data;
}

// El guard consulta el rol vigente antes de permitir cambios al evento.
@ApiTags("admin-events")
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@RequireRoles("ADMINISTRADOR")
@Controller("admin/events")
export class AdminEventsController {
  constructor(private readonly events: EventsService) {}

  @Get()
  @ApiOperation({ summary: "Lista eventos para administración" })
  list(@Query() query: unknown) { return this.events.list(validate(eventListSchema, query)); }

  @Get(":id")
  @ApiOperation({ summary: "Consulta un evento para administración" })
  get(@Param("id") id: string) { return this.events.get(validate(eventIdSchema, id)); }

  @Post()
  @ApiOperation({ summary: "Crea un evento en borrador" })
  create(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.events.create(validate(eventCreateSchema, body), request.principal!.userId);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Edita un borrador si no cambió desde la lectura" })
  update(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body() body: unknown) {
    return this.events.update(validate(eventIdSchema, id), validate(eventUpdateSchema, body), request.principal!.userId);
  }

  @Post(":id/publish")
  @HttpCode(200)
  @ApiOperation({ summary: "Publica un borrador completo" })
  publish(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body() body: unknown) {
    validate(emptyBodySchema, body ?? {});
    return this.events.publish(validate(eventIdSchema, id), request.principal!.userId);
  }

  @Post(":id/suspend")
  @HttpCode(200)
  @ApiOperation({ summary: "Suspende un evento publicado" })
  suspend(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body() body: unknown) {
    return this.events.suspend(validate(eventIdSchema, id), validate(eventSuspendSchema, body), request.principal!.userId);
  }

  @Post(":id/resume")
  @HttpCode(200)
  @ApiOperation({ summary: "Republica un evento suspendido" })
  resume(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body() body: unknown) {
    validate(emptyBodySchema, body ?? {});
    return this.events.resume(validate(eventIdSchema, id), request.principal!.userId);
  }
}
