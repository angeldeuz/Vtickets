import { Injectable, OnModuleDestroy, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";

// Una sola instancia Prisma comparte un pool pequeño entre solicitudes del proceso.
// La cuenta de DATABASE_URL debe heredar únicamente tickets_app_runtime.
@Injectable()
export class PrismaService implements OnModuleDestroy {
  private readonly instance: PrismaClient | null;

  constructor(config: ConfigService) {
    const connectionString = config.get<string>("DATABASE_URL") || "";
    this.instance = connectionString
      ? new PrismaClient({
          adapter: new PrismaPg({
            connectionString,
            max: config.get<number>("DB_POOL_MAX") ?? 5,
            connectionTimeoutMillis: 5_000,
            idleTimeoutMillis: 10_000,
          }),
        })
      : null;
  }

  get client(): PrismaClient {
    if (!this.instance) throw new ServiceUnavailableException("Base de datos no configurada");
    return this.instance;
  }

  async isReady(): Promise<boolean> {
    if (!this.instance) return false;
    try {
      await this.instance.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.instance?.$disconnect();
  }
}
