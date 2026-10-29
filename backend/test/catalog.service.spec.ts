import { CatalogService } from "../src/catalog/catalog.service";
import { PrismaService } from "../src/database/prisma.service";

const categoryId = "4e8620a3-cdc3-45e9-a1e1-0dc5b75d8de9";
const venueId = "58b14a1b-4048-465a-8b83-f4e55545f6c2";

describe("cursores del catálogo administrativo", () => {
  const categoryLookups: string[] = [];
  const venueLookups: string[] = [];
  const categoryPages: unknown[] = [];
  const venuePages: unknown[] = [];
  const service = new CatalogService({ client: {
    categoria: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        categoryLookups.push(where.id);
        return where.id === categoryId ? { id: categoryId } : null;
      },
      findMany: async (options: unknown) => { categoryPages.push(options); return [{ id: categoryId }]; },
    },
    ubicacion: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        venueLookups.push(where.id);
        return where.id === venueId ? { id: venueId } : null;
      },
      findMany: async (options: unknown) => { venuePages.push(options); return [{ id: venueId }]; },
    },
  } } as unknown as PrismaService);

  beforeEach(() => {
    categoryLookups.length = 0;
    venueLookups.length = 0;
    categoryPages.length = 0;
    venuePages.length = 0;
  });

  it("rechaza un cursor de ubicación al listar categorías", async () => {
    await expect(service.categories({ limit: 20, cursor: venueId })).rejects.toMatchObject({
      status: 400,
      response: { code: "INVALID_CURSOR" },
    });
    expect(categoryLookups).toEqual([venueId]);
    expect(categoryPages).toHaveLength(0);
  });

  it("rechaza un cursor de categoría al listar ubicaciones", async () => {
    await expect(service.venues({ limit: 20, cursor: categoryId })).rejects.toMatchObject({
      status: 400,
      response: { code: "INVALID_CURSOR" },
    });
    expect(venueLookups).toEqual([categoryId]);
    expect(venuePages).toHaveLength(0);
  });

  it("conserva la paginación con cursores de la colección correcta", async () => {
    await expect(service.categories({ limit: 20, cursor: categoryId })).resolves.toEqual({ items: [{ id: categoryId }], nextCursor: null });
    await expect(service.venues({ limit: 20, cursor: venueId })).resolves.toEqual({ items: [{ id: venueId }], nextCursor: null });
    expect(categoryPages[0]).toEqual(expect.objectContaining({ cursor: { id: categoryId }, skip: 1 }));
    expect(venuePages[0]).toEqual(expect.objectContaining({ cursor: { id: venueId }, skip: 1 }));
  });
});
