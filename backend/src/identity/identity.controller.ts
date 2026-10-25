import { BadRequestException, Body, Controller, Get, Patch, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { AuthGuard } from "./auth.guard";
import { IdentityService } from "./identity.service";
import type { AuthenticatedRequest, Principal } from "./principal";

const updateProfileSchema = z.strictObject({
  fullName: z.string().trim().min(1).max(120).nullable().optional(),
  phone: z.string().trim().min(7).max(25).nullable().optional(),
  avatarUrl: z.url().max(2048).nullable().optional(),
});

function principal(request: AuthenticatedRequest): Principal {
  return request.principal!; // AuthGuard ya asignó el perfil antes de entrar al controlador.
}

// Controlador: define las rutas HTTP; el servicio contiene las reglas de perfil.
@ApiTags("identity")
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller("me")
export class IdentityController {
  constructor(private readonly identity: IdentityService) {}

  @Get()
  @ApiOperation({ summary: "Devuelve el perfil propio y sus roles vigentes" })
  getMe(@Req() request: AuthenticatedRequest) {
    return this.identity.profile(principal(request));
  }

  @Patch()
  @ApiOperation({ summary: "Modifica únicamente campos editables del perfil propio" })
  updateMe(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const result = updateProfileSchema.safeParse(body);
    if (!result.success) throw new BadRequestException({ code: "VALIDATION_ERROR", message: "Perfil no válido" });
    return this.identity.update(principal(request), result.data);
  }

  @Get("roles")
  @ApiOperation({ summary: "Devuelve roles y asignaciones activas propias" })
  getRoles(@Req() request: AuthenticatedRequest) {
    return this.identity.assignments(principal(request));
  }
}
