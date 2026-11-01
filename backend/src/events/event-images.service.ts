import { randomUUID } from "node:crypto";
import { BadRequestException, ConflictException, Injectable, NotFoundException, PayloadTooLargeException } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import type { ImageQuery } from "./event-images.schemas";
import { EVENT_IMAGES_BUCKET, MAX_EVENT_IMAGE_BYTES, StorageService } from "./storage.service";

const formats = {
  "image/png": { extension: "png", matches: (b: Buffer) => b.length >= 24 && b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && b.toString("ascii", 12, 16) === "IHDR" },
  "image/jpeg": { extension: "jpg", matches: (b: Buffer) => b.length >= 4 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff && b[b.length - 2] === 0xff && b[b.length - 1] === 0xd9 },
  "image/webp": { extension: "webp", matches: (b: Buffer) => b.length >= 16 && b.toString("ascii", 0, 4) === "RIFF" && b.readUInt32LE(4) === b.length - 8 && b.toString("ascii", 8, 12) === "WEBP" && ["VP8 ", "VP8L", "VP8X"].includes(b.toString("ascii", 12, 16)) },
} as const;

function imageError(message: string): never {
  throw new BadRequestException({ code: "INVALID_IMAGE", message });
}

function errorCode(error: unknown): string | undefined {
  return error && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : undefined;
}

@Injectable()
export class EventImagesService {
  constructor(private readonly database: PrismaService, private readonly storage: StorageService) {}

  private async event(id: string) {
    const event = await this.database.client.evento.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!event) throw new NotFoundException("Evento no encontrado");
    return event;
  }

  private async editableEvent(id: string) {
    const event = await this.event(id);
    if (event.status !== "draft") throw new ConflictException({ code: "EVENT_NOT_EDITABLE", message: "Solo se pueden cambiar imágenes de un borrador" });
    return event;
  }

  async list(eventId: string) {
    await this.event(eventId);
    return this.database.client.eventoImagen.findMany({ where: { eventId }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  }

  async upload(eventId: string, contentType: string | undefined, bytes: Buffer, options: ImageQuery, actorUserId?: string) {
    await this.editableEvent(eventId);
    if (bytes.length > MAX_EVENT_IMAGE_BYTES) throw new PayloadTooLargeException({ code: "IMAGE_TOO_LARGE", message: "La imagen supera 5 MiB" });
    if (!bytes.length) imageError("La imagen está vacía");
    const mime = contentType?.toLowerCase().split(";")[0].trim() as keyof typeof formats | undefined;
    const format = mime && formats[mime];
    if (!format || !format.matches(bytes)) imageError("Formato de imagen no válido; usa PNG, JPEG o WebP");
    if (options.isCover && await this.database.client.eventoImagen.findFirst({ where: { eventId, isCover: true }, select: { id: true } })) {
      throw new ConflictException({ code: "EVENT_COVER_EXISTS", message: "El evento ya tiene portada" });
    }
    const path = `events/${eventId}/${randomUUID()}.${format.extension}`;
    await this.storage.upload(path, mime!, bytes);
    try {
      if (actorUserId) return await this.database.client.$transaction(async (tx) => {
        const row = await tx.eventoImagen.create({ data: {
          eventId, bucketId: EVENT_IMAGES_BUCKET, storagePath: path,
          altText: options.altText ?? null, isCover: options.isCover, sortOrder: options.sortOrder,
        } });
        await tx.auditoria.create({ data: { actorUserId, action: "event_image.uploaded", entityName: "evento_imagen", entityId: row.id,
          metadata: { eventId, isCover: row.isCover, sortOrder: row.sortOrder } } });
        return row;
      });
      return await this.database.client.eventoImagen.create({ data: {
        eventId, bucketId: EVENT_IMAGES_BUCKET, storagePath: path,
        altText: options.altText ?? null, isCover: options.isCover, sortOrder: options.sortOrder,
      } });
    } catch (error) {
      await this.storage.remove(path).catch(() => undefined);
      if (errorCode(error) === "P2002") throw new ConflictException({ code: "EVENT_COVER_EXISTS", message: "El evento ya tiene portada" });
      if (errorCode(error) === "P2003") throw new NotFoundException("Evento no encontrado");
      throw error;
    }
  }

  async image(eventId: string, imageId: string) {
    await this.event(eventId);
    const image = await this.database.client.eventoImagen.findFirst({ where: { id: imageId, eventId } });
    if (!image) throw new NotFoundException("Imagen no encontrada");
    return image;
  }

  async download(eventId: string, imageId: string) {
    const image = await this.image(eventId, imageId);
    return this.storage.download(image.storagePath);
  }

  async remove(eventId: string, imageId: string, actorUserId?: string): Promise<void> {
    await this.editableEvent(eventId);
    const image = await this.image(eventId, imageId);
    await this.storage.remove(image.storagePath);
    if (actorUserId) await this.database.client.$transaction(async (tx) => {
      await tx.eventoImagen.delete({ where: { id: imageId } });
      await tx.auditoria.create({ data: { actorUserId, action: "event_image.deleted", entityName: "evento_imagen", entityId: imageId,
        metadata: { eventId, isCover: image.isCover } } });
    });
    else await this.database.client.eventoImagen.delete({ where: { id: imageId } });
  }
}
