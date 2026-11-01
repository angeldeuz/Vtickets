import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";

// Prueba Storage real con un PNG temporal y lo elimina al terminar.
try { process.loadEnvFile(".env"); } catch { /* CI puede pasar las variables. */ }
const require = createRequire(import.meta.url);
require("reflect-metadata");
const { StorageService } = require("../dist/src/events/storage.service.js");
const storage = new StorageService({ get: (key) => process.env[key] });
const path = `events/00000000-0000-4000-8000-000000000000/verification-${randomUUID()}.png`;
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9BDZkAAAAASUVORK5CYII=", "base64");
let uploaded = false;
try {
  await storage.upload(path, "image/png", png);
  uploaded = true;
  const read = await storage.download(path);
  if (read.mime !== "image/png" || !read.bytes.equals(png)) throw new Error("La lectura no coincide con la imagen subida");
  console.log("F04-T03: subida y lectura de PNG temporal verificadas en Storage.");
} finally {
  if (uploaded) {
    await storage.remove(path);
    console.log("F04-T03: objeto temporal eliminado de Storage.");
  }
}
