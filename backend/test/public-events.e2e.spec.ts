import { INestApplication, NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { PublicEventsController } from "../src/events/public-events.controller";
import { PublicEventsService } from "../src/events/public-events.service";
import { ApiExceptionFilter } from "../src/common/api-exception.filter";

describe("rutas públicas F05", () => {
  let app: INestApplication;
  let missing = false;
  const events = {
    list: async () => ({ items: [{ slug: "concierto", title: "Concierto" }], nextCursor: null }),
    get: async (slug: string) => { if (missing) throw new NotFoundException("Evento no disponible"); return { slug, title: "Concierto" }; },
    cover: async () => { if (missing) throw new NotFoundException("Imagen no disponible"); return { bytes: Buffer.from("image"), mime: "image/png" }; },
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [PublicEventsController],
      providers: [{ provide: PublicEventsService, useValue: events }],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
  });

  afterAll(async () => { await app.close(); });
  beforeEach(() => { missing = false; });

  it("permite descubrir eventos y su detalle sin iniciar sesión", async () => {
    await request(app.getHttpServer()).get("/api/v1/public/events").expect(200).expect((res) => {
      expect(res.body.items[0].slug).toBe("concierto");
      expect(res.body.nextCursor).toBeNull();
    });
    await request(app.getHttpServer()).get("/api/v1/public/events/concierto").expect(200);
  });

  it("acepta slugs de 160 caracteres y rechaza límites de página inválidos", async () => {
    const slug = "a".repeat(160);
    await request(app.getHttpServer()).get(`/api/v1/public/events/${slug}`).expect(200);
    await request(app.getHttpServer()).get(`/api/v1/public/events/${slug}/cover`).expect(200);
    await request(app.getHttpServer()).get("/api/v1/public/events?limit=51").expect(400);
  });

  it("no muestra un evento no disponible ni su portada", async () => {
    missing = true;
    await request(app.getHttpServer()).get("/api/v1/public/events/borrador").expect(404);
    await request(app.getHttpServer()).get("/api/v1/public/events/borrador/cover").expect(404);
  });

  it("sirve la imagen con tipo y protección MIME", async () => {
    await request(app.getHttpServer()).get("/api/v1/public/events/concierto/cover")
      .expect(200).expect("Content-Type", /image\/png/).expect("X-Content-Type-Options", "nosniff");
  });
});
