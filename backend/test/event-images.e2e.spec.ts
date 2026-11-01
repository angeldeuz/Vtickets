import { INestApplication, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { ApiExceptionFilter } from "../src/common/api-exception.filter";
import { AdminEventImagesController } from "../src/events/event-images.controller";
import { EventImagesService } from "../src/events/event-images.service";
import { AuthGuard } from "../src/identity/auth.guard";
import { IdentityService } from "../src/identity/identity.service";
import { JwtVerifierService } from "../src/identity/jwt-verifier.service";
import { RolesGuard } from "../src/identity/roles.guard";

const id = "4e8620a3-cdc3-45e9-a1e1-0dc5b75d8de9";
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13]), Buffer.from("IHDR"), Buffer.alloc(20)]);

describe("HTTP de imágenes F04-T03", () => {
  let app: INestApplication;
  let writes = 0;
  const images = {
    list: async () => [],
    upload: async (_id: string, _mime: string, bytes: Buffer) => { writes++; return { id, size: bytes.length }; },
    remove: async () => {},
    download: async () => ({ bytes: png, mime: "image/png" }),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AdminEventImagesController],
      providers: [
        AuthGuard, RolesGuard, Reflector,
        { provide: EventImagesService, useValue: images },
        { provide: JwtVerifierService, useValue: { verify: async (token: string) => {
          if (token !== "admin" && token !== "client") throw new UnauthorizedException();
          return token;
        } } },
        { provide: IdentityService, useValue: { resolve: async (token: string) => ({
          authUserId: token, userId: id, roles: token === "admin" ? ["ADMINISTRADOR"] : ["CLIENTE"],
        }) } },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
  });
  afterAll(async () => { await app.close(); });

  it("impide subir sin administrador", async () => {
    await request(app.getHttpServer()).post(`/api/v1/admin/events/${id}/images`).set("Content-Type", "image/png").send(png).expect(401);
    await request(app.getHttpServer()).post(`/api/v1/admin/events/${id}/images`).set("Authorization", "Bearer client").set("Content-Type", "image/png").send(png).expect(403);
    expect(writes).toBe(0);
  });

  it("corta el cuerpo antes de pasar un archivo demasiado grande", async () => {
    await request(app.getHttpServer()).post(`/api/v1/admin/events/${id}/images`).set("Authorization", "Bearer admin")
      .set("Content-Type", "image/png").set("Content-Length", String(5 * 1024 * 1024 + 1)).send(png).expect(413);
    expect(writes).toBe(0);
  });

  it("acepta imagen binaria para administrador", async () => {
    const result = await request(app.getHttpServer()).post(`/api/v1/admin/events/${id}/images?isCover=true&altText=Portada`)
      .set("Authorization", "Bearer admin").set("Content-Type", "image/png").send(png).expect(201);
    expect(result.body.size).toBe(png.length);
    expect(writes).toBe(1);
  });
});
