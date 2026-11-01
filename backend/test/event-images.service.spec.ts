import { EventImagesService } from "../src/events/event-images.service";
import { PrismaService } from "../src/database/prisma.service";
import { StorageService } from "../src/events/storage.service";

const eventId = "4e8620a3-cdc3-45e9-a1e1-0dc5b75d8de9";
const imageId = "58b14a1b-4048-465a-8b83-f4e55545f6c2";
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13]), Buffer.from("IHDR"), Buffer.alloc(20)]);

describe("imágenes F04-T03", () => {
  let status: string;
  let uploads: string[];
  let removals: string[];
  let writes: number;
  let service: EventImagesService;

  beforeEach(() => {
    status = "draft"; uploads = []; removals = []; writes = 0;
    const database = { client: {
      evento: { findUnique: async () => ({ id: eventId, status }) },
      eventoImagen: {
        findFirst: async ({ where }: { where: { isCover?: boolean } }) => where.isCover ? null : { id: imageId, eventId, storagePath: `events/${eventId}/${imageId}.png` },
        create: async ({ data }: { data: { storagePath: string } }) => { writes++; return { id: imageId, ...data }; },
        delete: async () => { writes++; return {}; },
        findMany: async () => [],
      },
    } } as unknown as PrismaService;
    const storage = {
      upload: async (path: string) => { uploads.push(path); },
      remove: async (path: string) => { removals.push(path); },
      download: async () => ({ bytes: png, mime: "image/png" }),
    } as unknown as StorageService;
    service = new EventImagesService(database, storage);
  });

  it("rechaza MIME falsificado antes de subir", async () => {
    await expect(service.upload(eventId, "image/png", Buffer.from("not an image"), { isCover: false, sortOrder: 0 }))
      .rejects.toMatchObject({ status: 400, response: { code: "INVALID_IMAGE" } });
    expect(uploads).toHaveLength(0);
    expect(writes).toBe(0);
  });

  it("rechaza cambios de imágenes cuando el evento está publicado", async () => {
    status = "published";
    await expect(service.upload(eventId, "image/png", png, { isCover: false, sortOrder: 0 }))
      .rejects.toMatchObject({ status: 409, response: { code: "EVENT_NOT_EDITABLE" } });
    expect(uploads).toHaveLength(0);
  });

  it("guarda una ruta generada por servidor y registra la imagen", async () => {
    const result = await service.upload(eventId, "image/png", png, { isCover: true, sortOrder: 0, altText: "Portada" });
    expect(result).toMatchObject({ id: imageId, isCover: true, altText: "Portada", bucketId: "event-images" });
    expect(uploads[0]).toMatch(new RegExp(`^events/${eventId}/[a-f0-9-]+\\.png$`));
    expect(writes).toBe(1);
  });

  it("borra el objeto de Storage al eliminar la referencia", async () => {
    await service.remove(eventId, imageId);
    expect(removals).toEqual([`events/${eventId}/${imageId}.png`]);
    expect(writes).toBe(1);
  });
});
