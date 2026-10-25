import { randomUUID } from "node:crypto";
import { Injectable, Logger, NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  private readonly logger = new Logger("HTTP");

  use(request: Request & { requestId?: string }, response: Response, next: NextFunction): void {
    // Generamos un ID propio; no confiamos en una cabecera enviada por el cliente.
    const requestId = randomUUID();
    request.requestId = requestId;
    response.setHeader("X-Request-Id", requestId);
    const startedAt = Date.now();
    response.on("finish", () => {
      this.logger.log(`${request.method} ${request.path} ${response.statusCode} ${Date.now() - startedAt}ms ${requestId}`);
    });
    next();
  }
}
