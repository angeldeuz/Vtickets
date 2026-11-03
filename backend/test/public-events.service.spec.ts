import { PublicEventsService } from "../src/events/public-events.service";
import { PrismaService } from "../src/database/prisma.service";
import { StorageService } from "../src/events/storage.service";

const row = {
  id: "11111111-1111-4111-8111-111111111111", slug: "concierto", title: "Concierto", summary: "Música en vivo", description: "Concierto local",
  startsAt: new Date("2099-01-01T20:00:00Z"), salesStartsAt: null, salesEndsAt: null,
  timezone: "America/Mexico_City", status: "published",
  refCategoryId: { name: "Música" },
  refVenueId: { name: "Teatro", addressLine1: "Calle 1", city: "Saltillo", region: "Coahuila" },
  fromEventoImagenEventId: [{ id: "cover", altText: "Escenario", isCover: true, sortOrder: 0 }],
  fromTipoTicketEventId: [{ id: "ticket-1", name: "General", description: null,
    priceCents: 25000n, currency: "MXN", quantityTotal: 10, salesStartsAt: null as Date | null, salesEndsAt: null,
    fromInventarioTicketTypeId: { reservedCount: 3, soldCount: 2 } }],
};

const listQuery = { limit: 20 };

describe("catálogo público F05", () => {
  let service: PublicEventsService;
  let listOptions: Record<string, unknown>;
  let detailOptions: Record<string, unknown>;
  let detailRow: typeof row | null;
  let currentRow: typeof row;
  let listRows: typeof row[];
  let downloads: number;

  beforeEach(() => {
    listOptions = {}; detailOptions = {}; currentRow = structuredClone(row); listRows = [currentRow]; detailRow = currentRow; downloads = 0;
    service = new PublicEventsService({ client: { evento: {
      findMany: async (options: Record<string, unknown>) => { listOptions = options; return listRows; },
      findFirst: async (options: Record<string, unknown>) => { detailOptions = options; return detailRow; },
    } } } as unknown as PrismaService,
    { download: async () => { downloads++; return { bytes: Buffer.from("image"), mime: "image/png" }; } } as unknown as StorageService);
  });

  it("solo consulta próximos eventos publicados y calcula existencias reales", async () => {
    const events = await service.list(listQuery);
    expect(listOptions.where).toMatchObject({ status: "published", startsAt: { gt: expect.any(Date) } });
    expect(listOptions.take).toBe(21);
    expect(events.items[0].tickets[0]).toMatchObject({ price: 250, available: 5, saleStatus: "available" });
    expect(events.items[0].cover).toEqual({ alt: "Escenario" });
    expect(events.nextCursor).toBeNull();
  });

  it("limita cada página y conserva filtros y orden en el cursor", async () => {
    listRows = [currentRow, { ...currentRow, id: "22222222-2222-4222-8222-222222222222", startsAt: new Date("2099-01-02T20:00:00Z") }];
    const first = await service.list({ limit: 1, category: "Música", q: "Teatro" });
    expect(first.items).toHaveLength(1);
    expect(first.nextCursor).toEqual(expect.any(String));
    expect(listOptions.take).toBe(2);
    expect(listOptions.where).toMatchObject({ AND: expect.arrayContaining([
      { refCategoryId: { is: { name: "Música" } } },
      { OR: expect.any(Array) },
    ]) });

    await service.list({ limit: 1, category: "Música", q: "Teatro", cursor: first.nextCursor! });
    expect(listOptions.where).toMatchObject({ AND: expect.arrayContaining([{
      OR: [
        { startsAt: { gt: currentRow.startsAt } },
        { startsAt: currentRow.startsAt, id: { gt: currentRow.id } },
      ],
    }]) });
    await expect(service.list({ limit: 1, category: "Otra", q: "Teatro", cursor: first.nextCursor! })).rejects.toMatchObject({ status: 400 });
  });

  it("excluye en páginas posteriores los eventos que empezaron desde la primera consulta", async () => {
    const actualNow = Date.now;
    try {
      Date.now = () => new Date("2030-01-01T09:00:00Z").getTime();
      currentRow.startsAt = new Date("2030-01-01T09:15:00Z");
      listRows = [currentRow, { ...currentRow, id: "22222222-2222-4222-8222-222222222222", startsAt: new Date("2030-01-01T09:30:00Z") }];
      const first = await service.list({ limit: 1 });
      expect(first.nextCursor).toEqual(expect.any(String));
      expect(listOptions.where).toMatchObject({ startsAt: { gt: new Date("2030-01-01T09:00:00Z") } });

      Date.now = () => new Date("2030-01-01T10:00:00Z").getTime();
      await service.list({ limit: 1, cursor: first.nextCursor! });
      expect(listOptions.where).toMatchObject({ startsAt: { gt: new Date("2030-01-01T10:00:00Z") } });
      const cursor = JSON.parse(Buffer.from(first.nextCursor!, "base64url").toString("utf8"));
      expect(cursor).not.toHaveProperty("asOf");
    } finally {
      Date.now = actualNow;
    }
  });

  it("no entrega detalle de un evento no publicado", async () => {
    detailRow = null;
    await expect(service.get("borrador")).rejects.toMatchObject({ status: 404 });
    expect(detailOptions.where).toEqual({ slug: "borrador", status: "published" });
  });

  it("distingue venta futura y agotada sin presentar entradas como comprables", async () => {
    currentRow.fromTipoTicketEventId[0].salesStartsAt = new Date("2098-01-01T00:00:00Z");
    expect((await service.list(listQuery)).items[0].tickets[0].saleStatus).toBe("upcoming");
    currentRow.fromTipoTicketEventId[0].salesStartsAt = null;
    currentRow.fromTipoTicketEventId[0].quantityTotal = 5;
    expect((await service.list(listQuery)).items[0].tickets[0]).toMatchObject({ available: 0, saleStatus: "sold_out" });
  });

  it("solo sirve portadas de eventos publicados", async () => {
    detailRow = null;
    await expect(service.cover("borrador")).rejects.toMatchObject({ status: 404 });
    expect(downloads).toBe(0);
  });
});
