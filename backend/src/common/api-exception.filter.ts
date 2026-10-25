import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import type { Request, Response } from "express";

// Un filtro convierte errores a la forma acordada en F02 sin devolver trazas ni secretos.
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(error: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<Request & { requestId?: string }>();
    const status = error instanceof HttpException ? error.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = error instanceof HttpException ? error.getResponse() : null;
    const message = typeof body === "object" && body && "message" in body
      ? (Array.isArray(body.message) ? body.message.join("; ") : String(body.message))
      : error instanceof HttpException ? error.message : "Error interno del servidor";
    const code = typeof body === "object" && body && "code" in body
      ? String(body.code)
      : status === 401 ? "UNAUTHORIZED" : status === 403 ? "FORBIDDEN" : status === 404 ? "NOT_FOUND" : status === 429 ? "RATE_LIMITED" : status === 503 ? "UNAVAILABLE" : status >= 500 ? "INTERNAL_ERROR" : "BAD_REQUEST";

    if (status >= 500) this.logger.error(`Solicitud ${request.requestId ?? "desconocida"}: HTTP ${status}`);
    response.status(status).json({ error: { code, message, details: {}, requestId: request.requestId ?? "" } });
  }
}
