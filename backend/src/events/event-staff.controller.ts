import { Body, Controller, Get, HttpCode, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { AuthGuard } from "../identity/auth.guard";
import type { AuthenticatedRequest } from "../identity/principal";
import { RequireRoles, RolesGuard } from "../identity/roles.guard";
import { eventIdSchema } from "./events.schemas";
import { EventStaffService } from "./event-staff.service";
import { validateInput } from "../common/validate-input";
import { staffCreateSchema, staffIdSchema, staffUpdateSchema } from "./event-staff.schemas";

function validate<T extends z.ZodType>(schema: T, value: unknown): z.output<T> {
  return validateInput(schema, value, "Revisa los datos del personal");
}

@ApiTags("admin-event-staff")
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@RequireRoles("ADMINISTRADOR")
@Controller("admin/events/:eventId/staff")
export class AdminEventStaffController {
  constructor(private readonly staff: EventStaffService) {}

  @Get()
  @ApiOperation({ summary: "Lista el personal asignado al evento" })
  list(@Param("eventId") eventId: string) { return this.staff.list(validate(eventIdSchema, eventId)); }

  @Post()
  @ApiOperation({ summary: "Asigna personal de acceso al evento" })
  create(@Req() request: AuthenticatedRequest, @Param("eventId") eventId: string, @Body() body: unknown) {
    return this.staff.create(validate(eventIdSchema, eventId), validate(staffCreateSchema, body), request.principal!.userId);
  }

  @Patch(":assignmentId")
  @HttpCode(200)
  @ApiOperation({ summary: "Actualiza o retira una asignación" })
  update(@Req() request: AuthenticatedRequest, @Param("eventId") eventId: string,
    @Param("assignmentId") assignmentId: string, @Body() body: unknown) {
    return this.staff.update(validate(eventIdSchema, eventId), validate(staffIdSchema, assignmentId),
      validate(staffUpdateSchema, body), request.principal!.userId);
  }
}
