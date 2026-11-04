import { Body, Controller, Delete, Get, Headers, HttpCode, Param, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { validateInput } from "../common/validate-input";
import { AuthGuard } from "../identity/auth.guard";
import type { AuthenticatedRequest } from "../identity/principal";
import { RequireRoles, RolesGuard } from "../identity/roles.guard";
import { idempotencyKeySchema, reservationCreateSchema } from "./reservations.schemas";
import { z } from "zod";

const idSchema = z.uuid();
import { ReservationsService } from "./reservations.service";
import { CheckoutService } from "./checkout.service";

@ApiTags("reservations")
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@RequireRoles("CLIENTE")
@Controller("reservations")
export class ReservationsController {
  constructor(private readonly reservations: ReservationsService, private readonly checkout: CheckoutService) {}

  @Post()
  @ApiOperation({ summary: "Reserva temporal de entradas para el cliente autenticado" })
  create(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("idempotency-key") key: unknown) {
    const input = validateInput(reservationCreateSchema, body, "Revisa las entradas seleccionadas");
    const idempotencyKey = validateInput(idempotencyKeySchema, key, "Falta la clave de solicitud");
    return this.reservations.create(request.principal!.userId, input, idempotencyKey);
  }

  @Get(":id")
  @ApiOperation({ summary: "Consulta una reserva propia" })
  get(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.reservations.get(request.principal!.userId, validateInput(idSchema, id, "Reserva no válida"));
  }

  @Delete(":id")
  @HttpCode(204)
  @ApiOperation({ summary: "Libera una reserva propia una sola vez" })
  cancel(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.reservations.cancel(request.principal!.userId, validateInput(idSchema, id, "Reserva no válida"));
  }

  @Post(":id/checkout")
  @ApiOperation({ summary: "Prepara una compra pendiente desde una reserva vigente" })
  checkoutReservation(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Headers("idempotency-key") key: unknown) {
    const reservationId = validateInput(idSchema, id, "Reserva no válida");
    const idempotencyKey = validateInput(idempotencyKeySchema, key, "Falta la clave de solicitud");
    return this.checkout.create(request.principal!.userId, reservationId, idempotencyKey);
  }
}
