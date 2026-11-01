import { BadRequestException, Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { AuthGuard } from "../identity/auth.guard";
import { RequireRoles, RolesGuard } from "../identity/roles.guard";
import { AdminUsersService } from "./admin-users.service";

const querySchema = z.strictObject({ q: z.string().trim().max(120).optional() });

@ApiTags("admin-users")
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@RequireRoles("ADMINISTRADOR")
@Controller("admin/users")
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}
  @Get()
  @ApiOperation({ summary: "Busca perfiles activos para asignar personal" })
  list(@Query() query: unknown) {
    const result = querySchema.safeParse(query);
    if (!result.success) throw new BadRequestException({ code: "VALIDATION_ERROR", message: "Búsqueda de usuarios no válida" });
    return this.users.list(result.data.q);
  }
}
