import { Injectable } from "@nestjs/common";
import { Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../database/prisma.service";

export interface OutboxJob {
  id: string;
  job_type: string;
  payload: unknown;
  attempts: number;
}

@Injectable()
export class OutboxService {
  constructor(private readonly database: PrismaService) {}

  async claim(workerId: string, jobTypes: string[]): Promise<OutboxJob | null> {
    if (jobTypes.length === 0) return null;
    // La selección y el cambio de estado ocurren en una sola sentencia corta.
    // SKIP LOCKED reparte trabajos entre workers sin procesarlos dos veces a la vez.
    const rows = await this.database.client.$queryRaw<OutboxJob[]>(Prisma.sql`
      WITH candidate AS (
        SELECT id FROM tickets_app.outbox_trabajos
        WHERE job_type IN (${Prisma.join(jobTypes)})
          AND ((status IN ('pending', 'retry') AND available_at <= now())
            OR (status = 'processing' AND locked_at < now() - interval '5 minutes'))
        ORDER BY available_at, created_at, id
        LIMIT 1 FOR UPDATE SKIP LOCKED
      )
      UPDATE tickets_app.outbox_trabajos AS job
      SET status = 'processing', attempts = attempts + 1,
          locked_at = now(), locked_by = ${workerId}
      FROM candidate WHERE job.id = candidate.id
      RETURNING job.id, job.job_type, job.payload, job.attempts
    `);
    return rows[0] ?? null;
  }

  async complete(jobId: string, workerId: string): Promise<void> {
    await this.database.client.$executeRaw`
      UPDATE tickets_app.outbox_trabajos
      SET status = 'succeeded', completed_at = now(), locked_at = NULL, locked_by = NULL, last_error = NULL
      WHERE id = ${jobId}::uuid AND status = 'processing' AND locked_by = ${workerId}
    `;
  }

  async retry(job: OutboxJob, workerId: string, error: unknown): Promise<void> {
    const message = error instanceof Error ? error.name : "Error de procesamiento";
    await this.database.client.$executeRaw`
      UPDATE tickets_app.outbox_trabajos
      SET status = CASE WHEN attempts >= 5 THEN 'dead' ELSE 'retry' END,
          available_at = now() + make_interval(secs => LEAST(3600, (POWER(2, LEAST(attempts, 10)) * 5)::integer)),
          locked_at = NULL, locked_by = NULL, last_error = ${message.slice(0, 200)}
      WHERE id = ${job.id}::uuid AND status = 'processing' AND locked_by = ${workerId}
    `;
  }
}
