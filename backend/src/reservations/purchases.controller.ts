import { Controller, Get, Param, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { validateInput } from "../common/validate-input";
import { AuthGuard } from "../identity/auth.guard";
import type { AuthenticatedRequest } from "../identity/principal";
import { RequireRoles, RolesGuard } from "../identity/roles.guard";
import { CheckoutService } from "./checkout.service";

@ApiTags("purchases")
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@RequireRoles("CLIENTE")
@Controller("purchases")
export class PurchasesController {
  constructor(private readonly checkout: CheckoutService) {}

  @Get(":id")
  @ApiOperation({ summary: "Consulta el resumen y estado de una compra propia" })
  get(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.checkout.getPurchase(request.principal!.userId, validateInput(z.uuid(), id, "Compra no válida"));
  }
}
