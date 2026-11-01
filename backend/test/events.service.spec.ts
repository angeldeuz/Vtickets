import { EventsService } from "../src/events/events.service";
import { PrismaService } from "../src/database/prisma.service";

const id = "4e8620a3-cdc3-45e9-a1e1-0dc5b75d8de9";
const now = new Date("2030-01-01T00:00:00Z");
const event = {
  id, categoryId: id, venueId: id, capacityLimit: 100, status: "draft", updatedAt: now,
  startsAt: new Date("2031-01-01T18:00:00Z"), endsAt: new Date("2031-01-01T23:00:00Z"),
  salesStartsAt: null, salesEndsAt: null,
  refCategoryId: { isActive: true }, refVenueId: { capacity: 120 }, fromTipoTicketEventId: [] as Array<{
    status: string; quantityTotal: number; salesStartsAt: Date | null; salesEndsAt: Date | null;
  }>,
};

describe("reglas de eventos F04-T02", () => {
  let writes: number;
  let audits: unknown[];
  let service: EventsService;
  let onLock: (() => void) | null;

  beforeEach(() => {
    writes = 0; audits = []; onLock = null; event.status = "draft"; event.fromTipoTicketEventId = [];
    const tx = {
      $queryRaw: async () => { onLock?.(); return [{ id }]; },
      tipoTicket: { aggregate: async () => ({ _sum: { quantityTotal: 80 } }) },
      evento: {
        findUnique: async () => event,
        updateMany: async () => { writes++; return { count: 1 }; },
        findUniqueOrThrow: async () => event,
      },
      auditoria: { create: async (data: unknown) => { audits.push(data); } },
    };
    service = new EventsService({ client: {
      evento: {
        findUnique: async () => event,
        updateMany: async () => { writes++; return { count: 0 }; },
        create: async () => { writes++; return event; },
      },
      categoria: { findUnique: async () => ({ id, isActive: true }) },
      ubicacion: { findUnique: async () => ({ id, capacity: 120 }) },
      $transaction: async (fn: (value: typeof tx) => Promise<unknown>) => fn(tx),
    } } as unknown as PrismaService);
  });

  it("rechaza fechas cruzadas antes de escribir", async () => {
    await expect(service.create({
      title: "Evento", slug: "evento", categoryId: id, venueId: id,
      startsAt: "2031-01-01T18:00:00Z", endsAt: "2031-01-01T17:00:00Z",
      timezone: "America/Mexico_City", capacityLimit: 100,
    }, id)).rejects.toMatchObject({ status: 400 });
    expect(writes).toBe(0);
  });

  it("rechaza publicación sin un boleto activo", async () => {
    await expect(service.publish(id)).rejects.toMatchObject({ status: 400, response: { code: "INVALID_EVENT" } });
    expect(writes).toBe(0);
  });

  it("publica con boleto válido y no pisa una edición concurrente", async () => {
    event.fromTipoTicketEventId = [{ status: "active", quantityTotal: 10, salesStartsAt: null, salesEndsAt: null }];
    await expect(service.publish(id)).resolves.toMatchObject({ id });
    expect(writes).toBe(1);
    await expect(service.update(id, { title: "Nuevo", updatedAt: now.toISOString() })).rejects.toMatchObject({
      status: 409, response: { code: "EVENT_CHANGED" },
    });
  });

  it("vuelve a leer los boletos después del bloqueo antes de publicar o reanudar", async () => {
    for (const status of ["draft", "suspended"]) {
      event.status = status;
      event.fromTipoTicketEventId = [{ status: "active", quantityTotal: 10, salesStartsAt: null, salesEndsAt: null }];
      onLock = () => { event.fromTipoTicketEventId[0].status = "paused"; };
      const result = status === "draft" ? service.publish(id) : service.resume(id);
      await expect(result).rejects.toMatchObject({ status: 400, response: { code: "INVALID_EVENT" } });
      expect(writes).toBe(0);
    }
  });

  it("suspende desde publicado y registra el motivo en la misma transacción", async () => {
    event.status = "published";
    await service.suspend(id, { reason: "Pausa operativa" }, id);
    expect(writes).toBe(1);
    expect(audits[0]).toMatchObject({ data: { action: "event.suspended", metadata: { reason: "Pausa operativa" } } });
  });

  it("impide bajar el aforo de un borrador por debajo del stock asignado", async () => {
    await expect(service.update(id, { capacityLimit: 70, updatedAt: now.toISOString() }, id))
      .rejects.toMatchObject({ status: 400, response: { code: "INVALID_EVENT" } });
    expect(writes).toBe(0);
  });
});
