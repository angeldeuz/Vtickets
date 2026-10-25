import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { OutboxService, type OutboxJob } from "./outbox/outbox.service";

type Handler = (job: OutboxJob) => Promise<void>;
// Los módulos de correo, pagos y reservas registrarán aquí sus handlers en sus fases.
// Este tipo de diagnóstico permite probar reclamación y recuperación sin enviar mensajes.
const handlers: Record<string, Handler> = {
  "system.healthcheck": async () => {},
};

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule);
  if (!app.get(ConfigService).get<string>("DATABASE_URL")) {
    await app.close();
    throw new Error("El worker necesita DATABASE_URL de una cuenta PostgreSQL de privilegios mínimos");
  }
  const outbox = app.get(OutboxService);
  const workerId = `${hostname()}-${process.pid}-${randomUUID()}`;
  const logger = new Logger("Worker");
  let stopping = false;
  process.once("SIGINT", () => { stopping = true; });
  process.once("SIGTERM", () => { stopping = true; });

  while (!stopping) {
    try {
      const job = await outbox.claim(workerId, Object.keys(handlers));
      if (job) {
        try {
          await handlers[job.job_type](job);
          await outbox.complete(job.id, workerId);
        } catch (error) {
          await outbox.retry(job, workerId, error);
          logger.warn(`Trabajo ${job.id} programado para reintento`);
        }
      } else {
        await new Promise((done) => setTimeout(done, 1000));
      }
    } catch {
      logger.error("La consulta outbox falló; reintentando en cinco segundos");
      await new Promise((done) => setTimeout(done, 5000));
    }
  }
  await app.close();
}

void bootstrap();
