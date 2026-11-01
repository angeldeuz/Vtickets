// Crea o verifica el bucket privado de F04-T03 mediante Storage API, sin tocar
// directamente las tablas internas de Supabase. Requiere clave secreta local.
try { process.loadEnvFile(".env"); } catch { /* CI puede pasar variables directamente. */ }
const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error("Configura SUPABASE_URL y SUPABASE_SECRET_KEY en backend/.env");
const endpoint = `${url}/storage/v1/bucket/event-images`;
const headers = { apikey: key, "Content-Type": "application/json" };
const existing = await fetch(endpoint, { headers });
const existingBody = existing.ok ? await existing.json() : await existing.json().catch(() => ({}));
// Storage puede devolver NoSuchBucket con HTTP 400 en algunos proyectos.
if ((existing.status === 404 || existing.status === 400) && existingBody.code === "NoSuchBucket") {
  const created = await fetch(`${url}/storage/v1/bucket`, {
    method: "POST", headers,
    body: JSON.stringify({ id: "event-images", name: "event-images", public: false,
      file_size_limit: 5 * 1024 * 1024, allowed_mime_types: ["image/png", "image/jpeg", "image/webp"] }),
  });
  if (!created.ok) throw new Error(`Storage rechazó la creación del bucket (${created.status})`);
  console.log("Bucket privado event-images creado con límite de 5 MiB y MIME permitidos.");
} else if (!existing.ok) {
  throw new Error(`No se pudo verificar el bucket (${existing.status})`);
} else {
  const bucket = existingBody;
  const allowed = ["image/png", "image/jpeg", "image/webp"];
  if (bucket.public !== false || Number(bucket.file_size_limit) !== 5 * 1024 * 1024 ||
      !Array.isArray(bucket.allowed_mime_types) ||
      bucket.allowed_mime_types.length !== allowed.length || !allowed.every((mime) => bucket.allowed_mime_types.includes(mime))) {
    throw new Error("El bucket existente debe ser privado, limitar 5 MiB y admitir solo PNG, JPEG y WebP");
  }
  console.log("Bucket privado event-images verificado.");
}
