import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AuthGuard } from "../src/identity/auth.guard";
import { RolesGuard } from "../src/identity/roles.guard";
import { ReservationsController } from "../src/reservations/reservations.controller";
import { ReservationsService } from "../src/reservations/reservations.service";
import { CheckoutService } from "../src/reservations/checkout.service";

const eventId = "11111111-1111-4111-8111-111111111111";
const ticketTypeId = "22222222-2222-4222-8222-222222222222";
const userId = "33333333-3333-4333-8333-333333333333";
const body = { eventId, items: [{ ticketTypeId, quantity: 2 }] };

describe("rutas de reservas F06", () => {
  let app: INestApplication;
  const calls: unknown[][] = [];
  const checkoutCalls: unknown[][] = [];
  const reservations = {
    create: async (...args: unknown[]) => { calls.push(args); return { id: eventId, status: "active" }; },
    get: async () => ({ id: eventId, status: "active" }),
    cancel: async () => undefined,
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ReservationsController],
      providers: [{ provide: ReservationsService, useValue: reservations },
        { provide: CheckoutService, useValue: { create: async (...args: unknown[]) => {
          checkoutCalls.push(args); return { purchaseId: eventId, status: "awaiting_payment", checkoutUrl: null };
        } } }],
    }).overrideGuard(AuthGuard).useValue({ canActivate: (context: { switchToHttp: () => { getRequest: () => { principal: unknown } } }) => {
      context.switchToHttp().getRequest().principal = { userId, roles: ["CLIENTE"] }; return true;
    } }).overrideGuard(RolesGuard).useValue({ canActivate: () => true }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix("api/v1");
    await app.init();
  });

  afterAll(async () => { await app.close(); });
  beforeEach(() => { calls.length = 0; checkoutCalls.length = 0; });

  it("toma el cliente de la sesión y acepta una selección válida", async () => {
    await request(app.getHttpServer()).post("/api/v1/reservations")
      .set("Idempotency-Key", "reserva-prueba-123").send(body).expect(201);
    expect(calls).toEqual([[userId, body, "reserva-prueba-123"]]);
  });

  it("rechaza cantidades inválidas y solicitudes sin clave", async () => {
    await request(app.getHttpServer()).post("/api/v1/reservations")
      .set("Idempotency-Key", "reserva-prueba-123").send({ ...body, items: [{ ticketTypeId, quantity: 5 }] }).expect(400);
    await request(app.getHttpServer()).post("/api/v1/reservations").send(body).expect(400);
    expect(calls).toHaveLength(0);
  });

  it("prepara checkout de una reserva propia sin declarar un pago", async () => {
    await request(app.getHttpServer()).post(`/api/v1/reservations/${eventId}/checkout`)
      .set("Idempotency-Key", "checkout-prueba-123").send({}).expect(201)
      .expect((response) => { expect(response.body).toMatchObject({ status: "awaiting_payment", checkoutUrl: null }); });
    expect(checkoutCalls).toEqual([[userId, eventId, "checkout-prueba-123"]]);
    await request(app.getHttpServer()).post(`/api/v1/reservations/${eventId}/checkout`).send({}).expect(400);
  });
});
