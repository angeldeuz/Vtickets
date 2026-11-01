import { BadRequestException, Controller, Delete, Get, HttpCode, Param, PayloadTooLargeException, Post, Query, Req, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { z } from "zod";
import { AuthGuard } from "../identity/auth.guard";
import type { AuthenticatedRequest } from "../identity/principal";
import { RequireRoles, RolesGuard } from "../identity/roles.guard";
import { EventImagesService } from "./event-images.service";
import { imageIdSchema, imageQuerySchema } from "./event-images.schemas";
import { eventIdSchema } from "./events.schemas";
import { MAX_EVENT_IMAGE_BYTES } from "./storage.service";

function validate<T extends z.ZodType>(schema: T, value: unknown): z.output<T> {
  const result = schema.safeParse(value);
  if (!result.success) throw new BadRequestException({ code: "VALIDATION_ERROR", message: "Datos de imagen no válidos" });
  return result.data;
}

// El cuerpo se lee como bytes después de los guards. Se corta en 5 MiB incluso
// si el cliente omite Content-Length; Express no interpreta los MIME de imagen.
async function readImage(request: Request): Promise<Buffer> {
  const declared = Number(request.headers["content-length"] ?? 0);
  if (declared > MAX_EVENT_IMAGE_BYTES) throw new PayloadTooLargeException({ code: "IMAGE_TOO_LARGE", message: "La imagen supera 5 MiB" });
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += bytes.length;
    if (total > MAX_EVENT_IMAGE_BYTES) throw new PayloadTooLargeException({ code: "IMAGE_TOO_LARGE", message: "La imagen supera 5 MiB" });
    chunks.push(bytes);
  }
  return Buffer.concat(chunks);
}

@ApiTags("admin-event-images")
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@RequireRoles("ADMINISTRADOR")
@Controller("admin/events/:eventId/images")
export class AdminEventImagesController {
  constructor(private readonly images: EventImagesService) {}

  @Get()
  @ApiOperation({ summary: "Lista imágenes de un borrador" })
  list(@Param("eventId") eventId: string) { return this.images.list(validate(eventIdSchema, eventId)); }

  @Post()
  @ApiOperation({ summary: "Sube PNG, JPEG o WebP como cuerpo binario de hasta 5 MiB" })
  async upload(@Param("eventId") eventId: string, @Query() query: unknown, @Req() request: Request & AuthenticatedRequest) {
    const id = validate(eventIdSchema, eventId);
    const options = validate(imageQuerySchema, query);
    return this.images.upload(id, request.headers["content-type"], await readImage(request), options, request.principal!.userId);
  }

  @Get(":imageId/content")
  @ApiOperation({ summary: "Descarga una imagen del bucket privado" })
  async content(@Param("eventId") eventId: string, @Param("imageId") imageId: string, @Res() response: Response) {
    const result = await this.images.download(validate(eventIdSchema, eventId), validate(imageIdSchema, imageId));
    response.setHeader("Content-Type", result.mime);
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Cache-Control", "private, no-store");
    response.send(result.bytes);
  }

  @Delete(":imageId")
  @HttpCode(204)
  @ApiOperation({ summary: "Elimina una imagen del borrador y de Storage" })
  remove(@Req() request: AuthenticatedRequest, @Param("eventId") eventId: string, @Param("imageId") imageId: string) {
    return this.images.remove(validate(eventIdSchema, eventId), validate(imageIdSchema, imageId), request.principal!.userId);
  }
}
