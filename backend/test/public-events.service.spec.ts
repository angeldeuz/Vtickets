import { PublicEventsService } from "../src/events/public-events.service";
import { PrismaService } from "../src/database/prisma.service";
import { StorageService } from "../src/events/storage.service";

const row = {
  id: "event-1", slug: "concierto", title: "Concierto", summary: "Música en vivo", description: "Concierto local",
  startsAt: new Date("2099-01-01T20:00:00Z"), salesStartsAt: null, salesEndsAt: null,
  timezone: "America/Mexico_City", status: "published",
  refCategoryId: { name: "Música" },
  refVenueId: { name: "Teatro", addressLine1: "Calle 1", city: "Saltillo", region: "Coahuila" },
  fromEventoImagenEventId: [{ id: "cover", altText: "Escenario", isCover: true, sortOrder: 0 }],
  fromTipoTicketEventId: [{ id: "ticket-1", name: "General", description: null,
    priceCents: 25000n, currency: "MXN", quantityTotal: 10, salesStartsAt: null, salesEndsAt: null,
    fromInventarioTicketTypeId: { reservedCount: 3, soldCount: 2 } }],
};

describe("catálogo público F05", () => {
  let service: PublicEventsService;
  let listOptions: Record<string, unknown>;
  let detailOptions: Record<string, unknown>;
  let detailRow: typeof row | null;
  let currentRow: typeof row;
  let downloads: number;

  beforeEach(() => {
    listOptions = {}; detailOptions = {}; currentRow = structuredClone(row); detailRow = currentRow; downloads = 0;
    service = new PublicEventsService({ client: { evento: {
      findMany: async (options: Record<string, unknown>) => { listOptions = options; return [currentRow]; },
      findFirst: async (options: Record<string, unknown>) => { detailOptions = options; return detailRow; },
    } } } as unknown as PrismaService,
    { download: async () => { downloads++; return { bytes: Buffer.from("image"), mime: "image/png" }; } } as unknown as StorageService);
  });

  it("solo consulta próximos eventos publicados y calcula existencias reales", async () => {
    const events = await service.list();
    expect(listOptions.where).toMatchObject({ status: "published", startsAt: { gt: expect.any(Date) } });
    expect(events[0].tickets[0]).toMatchObject({ price: 250, available: 5, saleStatus: "available" });
    expect(events[0].cover).toEqual({ alt: "Escenario" });
  });

  it("no entrega detalle de un evento no publicado", async () => {
    detailRow = null;
    await expect(service.get("borrador")).rejects.toMatchObject({ status: 404 });
    expect(detailOptions.where).toEqual({ slug: "borrador", status: "published" });
  });

  it("distingue venta futura y agotada sin presentar entradas como comprables", async () => {
    currentRow.fromTipoTicketEventId[0].salesStartsAt = new Date("2098-01-01T00:00:00Z");
    expect((await service.list())[0].tickets[0].saleStatus).toBe("upcoming");
    currentRow.fromTipoTicketEventId[0].salesStartsAt = null;
    currentRow.fromTipoTicketEventId[0].quantityTotal = 5;
    expect((await service.list())[0].tickets[0]).toMatchObject({ available: 0, saleStatus: "sold_out" });
  });

  it("solo sirve portadas de eventos publicados", async () => {
    detailRow = null;
    await expect(service.cover("borrador")).rejects.toMatchObject({ status: 404 });
    expect(downloads).toBe(0);
  });
});
