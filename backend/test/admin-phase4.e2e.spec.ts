import { INestApplication, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { ApiExceptionFilter } from "../src/common/api-exception.filter";
import { AdminAuditController } from "../src/events/audit.controller";
import { AuditService } from "../src/events/audit.service";
import { AdminEventStaffController } from "../src/events/event-staff.controller";
import { EventStaffService } from "../src/events/event-staff.service";
import { AdminUsersController } from "../src/events/admin-users.controller";
import { AdminUsersService } from "../src/events/admin-users.service";
import { AuthGuard } from "../src/identity/auth.guard";
import { IdentityService } from "../src/identity/identity.service";
import { JwtVerifierService } from "../src/identity/jwt-verifier.service";
import { RolesGuard } from "../src/identity/roles.guard";

const id = "4e8620a3-cdc3-45e9-a1e1-0dc5b75d8de9";

describe("personal y auditoría administrativa F04-T06/T07", () => {
  let app: INestApplication;
  let writes = 0;
  beforeAll(async () => {
    const module = await Test.createTestingModule({ controllers: [AdminEventStaffController, AdminAuditController, AdminUsersController],
      providers: [AuthGuard, RolesGuard, Reflector,
        { provide: EventStaffService, useValue: { list: async () => [], create: async () => { writes++; return { id }; }, update: async () => { writes++; return { id, status: "withdrawn" }; } } },
        { provide: AuditService, useValue: { list: async () => ({ items: [], nextCursor: null }) } },
        { provide: AdminUsersService, useValue: { list: async () => [] } },
        { provide: JwtVerifierService, useValue: { verify: async (token: string) => {
          if (!["admin", "client"].includes(token)) throw new UnauthorizedException(); return token;
        } } },
        { provide: IdentityService, useValue: { resolve: async (token: string) => ({ authUserId: token, userId: id,
          roles: token === "admin" ? ["ADMINISTRADOR"] : ["CLIENTE"] }) } },
      ] }).compile();
    app = module.createNestApplication(); app.setGlobalPrefix("api/v1"); app.useGlobalFilters(new ApiExceptionFilter()); await app.init();
  });
  afterAll(async () => app.close());

  it("bloquea personal y auditoría a visitantes y clientes", async () => {
    await request(app.getHttpServer()).post(`/api/v1/admin/events/${id}/staff`).send({ userId: id, roleCode: "ACCESO" }).expect(401);
    await request(app.getHttpServer()).get("/api/v1/admin/audit").set("Authorization", "Bearer client").expect(403);
    await request(app.getHttpServer()).get("/api/v1/admin/users").set("Authorization", "Bearer client").expect(403);
    expect(writes).toBe(0);
  });

  it("valida el rol de acceso, vigencia y filtros antes de escribir", async () => {
    const auth = { Authorization: "Bearer admin" };
    await request(app.getHttpServer()).post(`/api/v1/admin/events/${id}/staff`).set(auth).send({ userId: id, roleCode: "ADMINISTRADOR" }).expect(400);
    await request(app.getHttpServer()).get("/api/v1/admin/audit?limit=101").set(auth).expect(400);
    await request(app.getHttpServer()).get("/api/v1/admin/users?q=" + "x".repeat(121)).set(auth).expect(400);
    expect(writes).toBe(0);
  });

  it("asigna y retira con rol administrador", async () => {
    const auth = { Authorization: "Bearer admin" };
    await request(app.getHttpServer()).post(`/api/v1/admin/events/${id}/staff`).set(auth).send({ userId: id, roleCode: "ACCESO" }).expect(201);
    await request(app.getHttpServer()).patch(`/api/v1/admin/events/${id}/staff/${id}`).set(auth).send({ status: "withdrawn" }).expect(200);
    expect(writes).toBe(2);
  });
});
