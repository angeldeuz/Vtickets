import { PrismaService } from "../src/database/prisma.service";
import { TicketTypesService } from "../src/events/ticket-types.service";

const id = "4e8620a3-cdc3-45e9-a1e1-0dc5b75d8de9";
const start = new Date("2030-11-01T18:00:00Z");
const input = { name: "General", priceCents: 25000, currency: "MXN" as const,
  quantityTotal: 50, maxPerOrder: 4, maxPerUser: 4, status: "active" as const };

describe("reglas de tipos de boleto F04-T04", () => {
  let service: TicketTypesService;
  let stock = 0;
  let allocated = 0;
  let eventStatus = "draft";
  const current = { id, eventId: id, name: "General", priceCents: 25000n, quantityTotal: 50,
    salesStartsAt: null, salesEndsAt: null, updatedAt: new Date("2030-01-01T00:00:00Z"),
    fromInventarioTicketTypeId: { reservedCount: 2, soldCount: 3 } };

  beforeEach(() => {
    stock = 0; allocated = 0; eventStatus = "draft";
    const tx = {
      $queryRaw: async () => [{ id }],
      inventario: { findUnique: async () => ({ reservedCount: 2, soldCount: 3 }) },
      evento: { findUnique: async () => ({ status: eventStatus, startsAt: start, salesStartsAt: null, salesEndsAt: null, capacityLimit: 60 }),
        findUniqueOrThrow: async () => ({ status: eventStatus, startsAt: start, salesStartsAt: null, salesEndsAt: null, capacityLimit: 60 }) },
      tipoTicket: {
        aggregate: async () => ({ _sum: { quantityTotal: allocated } }),
        findUnique: async () => ({ eventId: id }), findUniqueOrThrow: async () => current,
        create: async () => { stock++; return current; },
        updateMany: async () => { stock++; return { count: 1 }; },
      },
    };
    service = new TicketTypesService({ client: {
      $transaction: async (fn: (value: any) => Promise<unknown>) => fn(tx),
    } } as unknown as PrismaService);
  });

  it("crea tipo e inventario juntos dentro de una transacción", async () => {
    const result = await service.create(id, input);
    expect(result).toMatchObject({ priceCents: 25000, inventory: { reservedCount: 2, soldCount: 3 } });
    expect(stock).toBe(1);
  });

  it("rechaza aforo excedido y ventanas fuera del evento", async () => {
    allocated = 20;
    await expect(service.create(id, input)).rejects.toMatchObject({ response: { code: "INVALID_TICKET_TYPE" } });
    await expect(service.create(id, { ...input, quantityTotal: 1, salesEndsAt: "2030-11-02T00:00:00Z" }))
      .rejects.toMatchObject({ response: { code: "INVALID_TICKET_TYPE" } });
    expect(stock).toBe(0);
  });

  it("impide modificar un evento publicado y bajar stock bajo compromisos", async () => {
    eventStatus = "published";
    await expect(service.create(id, input)).rejects.toMatchObject({ response: { code: "TICKET_TYPE_CHANGED" } });
    eventStatus = "draft"; allocated = 50;
    await expect(service.update(id, { quantityTotal: 4, updatedAt: current.updatedAt.toISOString() }))
      .rejects.toMatchObject({ response: { code: "INVALID_TICKET_TYPE" } });
    expect(stock).toBe(0);
  });

  it("permite subir stock publicado, pero bloquea cambios de precio", async () => {
    eventStatus = "published"; allocated = 50;
    await expect(service.update(id, { priceCents: 30000, updatedAt: current.updatedAt.toISOString() }))
      .rejects.toMatchObject({ response: { code: "TICKET_TYPE_CHANGED" } });
    await expect(service.update(id, { quantityTotal: 55, updatedAt: current.updatedAt.toISOString() }))
      .resolves.toMatchObject({ priceCents: 25000 });
    expect(stock).toBe(1);
  });
});
