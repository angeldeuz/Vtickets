import { BadRequestException, Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { AuthGuard } from "../identity/auth.guard";
import { RequireRoles, RolesGuard } from "../identity/roles.guard";
import { AuditService } from "./audit.service";

const querySchema = z.strictObject({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  cursor: z.uuid().optional(), actorUserId: z.uuid().optional(),
  entityName: z.enum(["categoria", "ubicacion", "evento", "tipo_ticket", "evento_imagen", "personal_evento"]).optional(),
  from: z.iso.datetime({ offset: true }).optional(), to: z.iso.datetime({ offset: true }).optional(),
});
export type AuditQuery = z.infer<typeof querySchema>;

@ApiTags("admin-audit")
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@RequireRoles("ADMINISTRADOR")
@Controller("admin/audit")
export class AdminAuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @ApiOperation({ summary: "Consulta la auditoría administrativa paginada" })
  list(@Query() query: unknown) {
    const parsed = querySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException({ code: "VALIDATION_ERROR", message: "Filtros de auditoría no válidos" });
    return this.audit.list(parsed.data);
  }
}
