import { ConfigService } from "@nestjs/config";
import { StorageService } from "../src/events/storage.service";

describe("cliente HTTP privado de Storage", () => {
  const previousFetch = global.fetch;
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const service = new StorageService({ get: (key: string) => ({
    SUPABASE_URL: "https://project.supabase.co",
    SUPABASE_SECRET_KEY: "sb_secret_test",
  } as Record<string, string>)[key] } as ConfigService);

  beforeEach(() => {
    calls.length = 0;
    global.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return new Response("{}", { status: 200 });
    }) as typeof fetch;
  });
  afterAll(() => { global.fetch = previousFetch; });

  it("sube con la clave solo en apikey y sin sobrescribir objetos", async () => {
    await service.upload("events/id/file.png", "image/png", Buffer.from("png"));
    expect(calls[0].url).toBe("https://project.supabase.co/storage/v1/object/event-images/events/id/file.png");
    expect(calls[0].init?.method).toBe("POST");
    expect(calls[0].init?.headers).toEqual({ apikey: "sb_secret_test" });
    expect(calls[0].init?.body).toBeInstanceOf(FormData);
  });

  it("elimina por lote de prefijos en la API de Storage", async () => {
    await service.remove("events/id/file.png");
    expect(calls[0].url).toBe("https://project.supabase.co/storage/v1/object/event-images");
    expect(calls[0].init?.method).toBe("DELETE");
    expect(calls[0].init?.body).toBe(JSON.stringify({ prefixes: ["events/id/file.png"] }));
  });
});
