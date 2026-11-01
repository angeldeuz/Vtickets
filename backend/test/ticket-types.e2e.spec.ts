import { INestApplication, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { ApiExceptionFilter } from "../src/common/api-exception.filter";
import { AdminTicketTypesController } from "../src/events/ticket-types.controller";
import { TicketTypesService } from "../src/events/ticket-types.service";
import { AuthGuard } from "../src/identity/auth.guard";
import { IdentityService } from "../src/identity/identity.service";
import { JwtVerifierService } from "../src/identity/jwt-verifier.service";
import { RolesGuard } from "../src/identity/roles.guard";

const id = "4e8620a3-cdc3-45e9-a1e1-0dc5b75d8de9";
const valid = { name: "General", priceCents: 25000, quantityTotal: 50, maxPerOrder: 4, maxPerUser: 4 };

describe("tipos de boleto administrativos F04-T04", () => {
  let app: INestApplication;
  let writes = 0;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AdminTicketTypesController],
      providers: [
        AuthGuard, RolesGuard, Reflector,
        { provide: TicketTypesService, useValue: {
          list: async () => [], create: async (_id: string, body: unknown) => { writes++; return { id, ...body as object }; },
          update: async () => { writes++; return { id }; },
        } },
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
  afterAll(async () => app.close());

  it("protege las rutas y rechaza límites o moneda inválidos", async () => {
    const url = `/api/v1/admin/events/${id}/ticket-types`;
    await request(app.getHttpServer()).post(url).send(valid).expect(401);
    await request(app.getHttpServer()).post(url).set("Authorization", "Bearer client").send(valid).expect(403);
    await request(app.getHttpServer()).post(url).set("Authorization", "Bearer admin").send({ ...valid, maxPerUser: 5 }).expect(400);
    await request(app.getHttpServer()).post(url).set("Authorization", "Bearer admin").send({ ...valid, currency: "USD" }).expect(400);
    expect(writes).toBe(0);
  });

  it("crea y exige versión para editar", async () => {
    const auth = { Authorization: "Bearer admin" };
    const created = await request(app.getHttpServer()).post(`/api/v1/admin/events/${id}/ticket-types`).set(auth).send(valid).expect(201);
    expect(created.body).toMatchObject({ name: "General", currency: "MXN", priceCents: 25000 });
    await request(app.getHttpServer()).patch(`/api/v1/admin/ticket-types/${id}`).set(auth).send({ quantityTotal: 60 }).expect(400);
    await request(app.getHttpServer()).patch(`/api/v1/admin/ticket-types/${id}`).set(auth)
      .send({ quantityTotal: 60, updatedAt: "2030-01-01T00:00:00Z" }).expect(200);
    expect(writes).toBe(2);
  });
});
