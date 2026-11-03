import { Controller, Get, Param, Query, Res } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { z } from "zod";
import { validateInput } from "../common/validate-input";
import { PublicEventsService } from "./public-events.service";
import { publicEventListSchema } from "./public-events.schemas";

const slugSchema = z.string().min(2).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

// Rutas sin guard: solo consultan eventos publicados. La autorización de edición
// permanece en los controladores administrativos de la fase anterior.
@ApiTags("public-events")
@Controller("public/events")
export class PublicEventsController {
  constructor(private readonly events: PublicEventsService) {}

  @Get()
  @ApiOperation({ summary: "Cartelera pública de próximos eventos publicados" })
  list(@Query() query: unknown) { return this.events.list(validateInput(publicEventListSchema, query, "Filtros de eventos no válidos")); }

  @Get(":slug")
  @ApiOperation({ summary: "Detalle público de un evento publicado" })
  get(@Param("slug") slug: string) {
    return this.events.get(validateInput(slugSchema, slug, "Evento no válido"));
  }

  @Get(":slug/cover")
  @ApiOperation({ summary: "Portada de un evento publicado desde Storage privado" })
  async cover(@Param("slug") slug: string, @Res() response: Response) {
    const image = await this.events.cover(validateInput(slugSchema, slug, "Evento no válido"));
    response.setHeader("Content-Type", image.mime);
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Cache-Control", "public, max-age=60");
    response.send(image.bytes);
  }
}
