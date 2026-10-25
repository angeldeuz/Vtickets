import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { ApiExceptionFilter } from "./common/api-exception.filter";

// Punto de entrada de NestJS: crea el servidor HTTP y conecta los módulos de AppModule.
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  app.setGlobalPrefix("api/v1");
  app.enableCors({ origin: config.getOrThrow<string>("WEB_ORIGIN"), methods: ["GET", "POST", "PATCH", "DELETE"], allowedHeaders: ["Authorization", "Content-Type", "Idempotency-Key"] });
  app.useGlobalFilters(new ApiExceptionFilter());

  const document = SwaggerModule.createDocument(app, new DocumentBuilder()
    .setTitle("Vtickets API")
    .setDescription("Contratos de la plataforma de entradas")
    .setVersion("0.1.0")
    .addBearerAuth()
    .build());
  SwaggerModule.setup("api/docs", app, document);

  const port = config.getOrThrow<number>("API_PORT");
  await app.listen(port, "127.0.0.1");
  Logger.log(`API disponible en http://127.0.0.1:${port}/api/v1/health`, "Bootstrap");
}

void bootstrap();
