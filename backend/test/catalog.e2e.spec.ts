import { INestApplication, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { jest } from "@jest/globals";
import request from "supertest";
import { AdminCatalogController, PublicCategoriesController } from "../src/catalog/catalog.controller";
import { CatalogService } from "../src/catalog/catalog.service";
import { ApiExceptionFilter } from "../src/common/api-exception.filter";
import { AuthGuard } from "../src/identity/auth.guard";
import { IdentityService } from "../src/identity/identity.service";
import { JwtVerifierService } from "../src/identity/jwt-verifier.service";
import { RolesGuard } from "../src/identity/roles.guard";

describe("catálogo F04-T01", () => {
  let app: INestApplication;
  const catalog = {
    publicCategories: jest.fn().mockResolvedValue([{ id: "1", name: "Música", slug: "musica", description: null }]),
    categories: jest.fn().mockResolvedValue({ items: [], nextCursor: null }),
    venues: jest.fn().mockResolvedValue({ items: [], nextCursor: null }),
    createCategory: jest.fn().mockImplementation(async (data: unknown) => data),
    updateCategory: jest.fn(),
    createVenue: jest.fn().mockImplementation(async (data: unknown) => data),
    updateVenue: jest.fn(),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [PublicCategoriesController, AdminCatalogController],
      providers: [
        AuthGuard, RolesGuard, Reflector,
        { provide: CatalogService, useValue: catalog },
        { provide: JwtVerifierService, useValue: { verify: async (token: string) => {
          if (token !== "admin" && token !== "client") throw new UnauthorizedException();
          return token;
        } } },
        { provide: IdentityService, useValue: { resolve: async (token: string) => ({
          authUserId: token, userId: "4e8620a3-cdc3-45e9-a1e1-0dc5b75d8de9",
          roles: token === "admin" ? ["ADMINISTRADOR"] : ["CLIENTE"],
        }) } },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
  });

  afterAll(async () => { await app.close(); });

  it("expone categorías activas sin sesión", async () => {
    const response = await request(app.getHttpServer()).get("/api/v1/categories").expect(200);
    expect(response.body[0].slug).toBe("musica");
  });

  it("impide la administración sin sesión y con rol cliente", async () => {
    await request(app.getHttpServer()).post("/api/v1/admin/categories").send({ name: "Música", slug: "musica" }).expect(401);
    await request(app.getHttpServer()).post("/api/v1/admin/categories").set("Authorization", "Bearer client")
      .send({ name: "Música", slug: "musica" }).expect(403);
    expect(catalog.createCategory).not.toHaveBeenCalled();
  });

  it("valida slug y zona horaria antes de escribir", async () => {
    await request(app.getHttpServer()).post("/api/v1/admin/categories").set("Authorization", "Bearer admin")
      .send({ name: "Música", slug: "Música!" }).expect(400);
    await request(app.getHttpServer()).post("/api/v1/admin/venues").set("Authorization", "Bearer admin")
      .send({ name: "Teatro", timezone: "Invalid/Zone" }).expect(400);
    expect(catalog.createCategory).not.toHaveBeenCalled();
    expect(catalog.createVenue).not.toHaveBeenCalled();
  });

  it("acepta datos válidos de administrador", async () => {
    const response = await request(app.getHttpServer()).post("/api/v1/admin/venues").set("Authorization", "Bearer admin")
      .send({ name: "Teatro de la Ciudad", city: "Saltillo", countryCode: "MX", timezone: "America/Monterrey", capacity: 500 }).expect(201);
    expect(response.body.capacity).toBe(500);
    expect(catalog.createVenue).toHaveBeenCalledTimes(1);
  });
});
