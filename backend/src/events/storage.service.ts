import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export const EVENT_IMAGES_BUCKET = "event-images";
export const MAX_EVENT_IMAGE_BYTES = 5 * 1024 * 1024;

// La clave secreta queda exclusivamente en la API. Storage recibe rutas generadas
// por el servidor y nunca un nombre de objeto proporcionado por el navegador.
@Injectable()
export class StorageService {
  constructor(private readonly config: ConfigService) {}

  private settings() {
    const url = this.config.get<string>("SUPABASE_URL");
    const key = this.config.get<string>("SUPABASE_SECRET_KEY");
    if (!url || !key) throw new ServiceUnavailableException({ code: "STORAGE_NOT_CONFIGURED", message: "Storage no configurado" });
    return { base: `${url.replace(/\/$/, "")}/storage/v1`, key };
  }

  async upload(path: string, mime: string, bytes: Buffer): Promise<void> {
    const { base, key } = this.settings();
    const form = new FormData();
    form.append("cacheControl", "3600");
    form.append("", new Blob([new Uint8Array(bytes)], { type: mime }), path.split("/").at(-1));
    try {
      const response = await fetch(`${base}/object/${EVENT_IMAGES_BUCKET}/${path}`, {
        method: "POST", headers: { apikey: key }, body: form, signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error(`Storage upload ${response.status}`);
    } catch {
      throw new ServiceUnavailableException({ code: "STORAGE_UPLOAD_FAILED", message: "No se pudo guardar la imagen" });
    }
  }

  async remove(path: string): Promise<void> {
    const { base, key } = this.settings();
    try {
      const response = await fetch(`${base}/object/${EVENT_IMAGES_BUCKET}`, {
        method: "DELETE", headers: { apikey: key, "Content-Type": "application/json" },
        body: JSON.stringify({ prefixes: [path] }), signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error(`Storage delete ${response.status}`);
    } catch {
      throw new ServiceUnavailableException({ code: "STORAGE_DELETE_FAILED", message: "No se pudo eliminar la imagen" });
    }
  }

  async download(path: string): Promise<{ bytes: Buffer; mime: string }> {
    const { base, key } = this.settings();
    try {
      const response = await fetch(`${base}/object/authenticated/${EVENT_IMAGES_BUCKET}/${path}`, {
        headers: { apikey: key }, signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error(`Storage download ${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length > MAX_EVENT_IMAGE_BYTES) throw new Error("Storage object too large");
      return { bytes, mime: response.headers.get("content-type") ?? "application/octet-stream" };
    } catch {
      throw new ServiceUnavailableException({ code: "STORAGE_READ_FAILED", message: "No se pudo leer la imagen" });
    }
  }
}
