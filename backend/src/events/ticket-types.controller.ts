import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { AuthGuard } from "../identity/auth.guard";
import { RequireRoles, RolesGuard } from "../identity/roles.guard";
import type { AuthenticatedRequest } from "../identity/principal";
import { eventIdSchema } from "./events.schemas";
import { TicketTypesService } from "./ticket-types.service";
import { validateInput } from "../common/validate-input";
import { ticketTypeCreateSchema, ticketTypeIdSchema, ticketTypeUpdateSchema } from "./ticket-types.schemas";

function validate<T extends z.ZodType>(schema: T, value: unknown): z.output<T> {
  return validateInput(schema, value, "Revisa los datos del boleto");
}

@ApiTags("admin-ticket-types")
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@RequireRoles("ADMINISTRADOR")
@Controller("admin")
export class AdminTicketTypesController {
  constructor(private readonly tickets: TicketTypesService) {}

  @Get("events/:eventId/ticket-types")
  @ApiOperation({ summary: "Lista tipos de boleto e inventario del evento" })
  list(@Param("eventId") eventId: string) {
    return this.tickets.list(validate(eventIdSchema, eventId));
  }

  @Post("events/:eventId/ticket-types")
  @ApiOperation({ summary: "Crea un tipo de boleto en un evento borrador" })
  create(@Req() request: AuthenticatedRequest, @Param("eventId") eventId: string, @Body() body: unknown) {
    return this.tickets.create(validate(eventIdSchema, eventId), validate(ticketTypeCreateSchema, body), request.principal!.userId);
  }

  @Patch("ticket-types/:id")
  @ApiOperation({ summary: "Edita un tipo de boleto de un borrador si no cambió" })
  update(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body() body: unknown) {
    return this.tickets.update(validate(ticketTypeIdSchema, id), validate(ticketTypeUpdateSchema, body), request.principal!.userId);
  }
}
