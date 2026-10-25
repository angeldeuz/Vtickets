import { MiddlewareConsumer, Module, NestModule, RequestMethod } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { validateEnv } from "./config/env";
import { RequestContextMiddleware } from "./common/request-context.middleware";
import { DatabaseModule } from "./database/database.module";
import { HealthController } from "./health/health.controller";
import { IdentityModule } from "./identity/identity.module";
import { OutboxModule } from "./outbox/outbox.module";

// Un módulo agrupa proveedores y controladores; Nest resuelve sus dependencias por inyección.
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    DatabaseModule,
    IdentityModule,
    OutboxModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes({ path: "{*path}", method: RequestMethod.ALL });
  }
}
