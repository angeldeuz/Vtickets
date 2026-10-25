import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { PrismaService } from "../database/prisma.service";

@ApiTags("health")
@Controller()
export class HealthController {
  constructor(private readonly database: PrismaService) {}

  @Get("health")
  @ApiOperation({ summary: "Comprueba que el proceso API responde" })
  live() {
    return { status: "ok" };
  }

  @Get("ready")
  @ApiOperation({ summary: "Comprueba la conexión de negocio a PostgreSQL" })
  async ready() {
    if (!(await this.database.isReady())) {
      throw new ServiceUnavailableException("Base de datos no disponible");
    }
    return { status: "ready" };
  }
}
