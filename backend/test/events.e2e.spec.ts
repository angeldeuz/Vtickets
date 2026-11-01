import { INestApplication, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { ApiExceptionFilter } from "../src/common/api-exception.filter";
import { AdminEventsController } from "../src/events/events.controller";
import { EventsService } from "../src/events/events.service";
import { AuthGuard } from "../src/identity/auth.guard";
import { IdentityService } from "../src/identity/identity.service";
import { JwtVerifierService } from "../src/identity/jwt-verifier.service";
import { RolesGuard } from "../src/identity/roles.guard";

const id = "4e8620a3-cdc3-45e9-a1e1-0dc5b75d8de9";
const payload = {
  title: "Festival de otoño", slug: "festival-de-otono", categoryId: id, venueId: id,
  startsAt: "2030-11-01T18:00:00-06:00", endsAt: "2030-11-02T00:00:00-06:00",
  timezone: "America/Mexico_City", capacityLimit: 100,
};

describe("eventos administrativos F04-T02", () => {
  let app: INestApplication;
  let writes = 0;
  const events = {
    list: async () => ({ items: [], nextCursor: null }),
    get: async () => ({ id, status: "draft" }),
    create: async (data: unknown, organizerId: string) => { writes++; return { id, status: "draft", organizerId, ...data as object }; },
    update: async () => ({ id, status: "draft" }),
    publish: async () => ({ id, status: "published" }),
    suspend: async () => ({ id, status: "suspended" }),
    resume: async () => ({ id, status: "published" }),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AdminEventsController],
      providers: [
        AuthGuard, RolesGuard, Reflector,
        { provide: EventsService, useValue: events },
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

  it("impide crear eventos sin rol administrador", async () => {
    await request(app.getHttpServer()).post("/api/v1/admin/events").send(payload).expect(401);
    await request(app.getHttpServer()).post("/api/v1/admin/events").set("Authorization", "Bearer client").send(payload).expect(403);
    expect(writes).toBe(0);
  });

  it("valida campos, fechas con offset y precondición de edición", async () => {
    const admin = { Authorization: "Bearer admin" };
    const invalid = await request(app.getHttpServer()).post("/api/v1/admin/events").set(admin)
      .send({ ...payload, startsAt: "2030-11-01T18:00:00", extra: true }).expect(400);
    expect(invalid.body.error.details.fields.startsAt).toBeDefined();
    await request(app.getHttpServer()).patch(`/api/v1/admin/events/${id}`).set(admin)
      .send({ title: "Nuevo título" }).expect(400);
    expect(writes).toBe(0);
  });

  it("crea un borrador y expone las transiciones administrativas", async () => {
    const admin = { Authorization: "Bearer admin" };
    const created = await request(app.getHttpServer()).post("/api/v1/admin/events").set(admin).send(payload).expect(201);
    expect(created.body.status).toBe("draft");
    expect(created.body.organizerId).toBe(id);
    await request(app.getHttpServer()).post(`/api/v1/admin/events/${id}/publish`).set(admin).send({}).expect(200);
    await request(app.getHttpServer()).post(`/api/v1/admin/events/${id}/suspend`).set(admin).send({ reason: "Pausa operativa" }).expect(200);
    await request(app.getHttpServer()).post(`/api/v1/admin/events/${id}/resume`).set(admin).send({}).expect(200);
  });
});
