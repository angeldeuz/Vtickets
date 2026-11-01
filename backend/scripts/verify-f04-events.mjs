import { randomUUID } from "node:crypto";
import pg from "pg";

// Prueba las escrituras del rol de la API en PostgreSQL y revierte todos los datos.
try { process.loadEnvFile(".env"); } catch { /* CI puede pasar DATABASE_URL directamente. */ }
if (!process.env.DATABASE_URL) throw new Error("Configura DATABASE_URL para verificar eventos");

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 5000 });
let client;
try {
  client = await pool.connect();
  await client.query("BEGIN");
  const organizer = await client.query("SELECT id FROM tickets_app.usuarios WHERE status = 'active' LIMIT 1");
  if (!organizer.rows[0]) throw new Error("Se necesita un usuario de desarrollo activo para verificar la FK del organizador");
  const category = await client.query("INSERT INTO tickets_app.categorias (name, slug) VALUES ($1, $2) RETURNING id", ["Categoría temporal", `f04-${randomUUID()}`]);
  const venue = await client.query("INSERT INTO tickets_app.ubicaciones (name, timezone, capacity) VALUES ($1, $2, $3) RETURNING id", ["Recinto temporal", "America/Mexico_City", 100]);
  const created = await client.query(
    `INSERT INTO tickets_app.eventos
      (category_id, venue_id, organizer_id, title, slug, starts_at, ends_at, timezone, capacity_limit)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id, status`,
    [category.rows[0].id, venue.rows[0].id, organizer.rows[0].id, "Evento temporal", `f04-${randomUUID()}`,
      "2031-01-01T18:00:00Z", "2031-01-01T23:00:00Z", "America/Mexico_City", 100],
  );
  if (created.rows[0].status !== "draft") throw new Error("El evento no comenzó como borrador");
  const published = await client.query("UPDATE tickets_app.eventos SET status = 'published' WHERE id = $1 RETURNING status", [created.rows[0].id]);
  const suspended = await client.query("UPDATE tickets_app.eventos SET status = 'suspended' WHERE id = $1 RETURNING status", [created.rows[0].id]);
  if (published.rows[0]?.status !== "published" || suspended.rows[0]?.status !== "suspended") throw new Error("La transición no se guardó");
  const image = await client.query(
    "INSERT INTO tickets_app.evento_imagenes (event_id, bucket_id, storage_path) VALUES ($1, $2, $3) RETURNING id",
    [created.rows[0].id, "event-images", `events/${created.rows[0].id}/${randomUUID()}.png`],
  );
  const removed = await client.query("DELETE FROM tickets_app.evento_imagenes WHERE id = $1 RETURNING id", [image.rows[0].id]);
  if (!removed.rows[0]?.id) throw new Error("No se eliminó la referencia de imagen");
  const audit = await client.query(
    "INSERT INTO tickets_app.auditoria (actor_user_id, action, entity_name, entity_id, metadata) VALUES ($1, $2, $3, $4, $5::jsonb) RETURNING id",
    [organizer.rows[0].id, "event.suspended", "evento", created.rows[0].id, JSON.stringify({ reason: "Verificación temporal" })],
  );
  if (!audit.rows[0]?.id) throw new Error("No se registró el motivo de suspensión");
  console.log("F04: evento, imagen, DELETE y auditoría permitidos para el rol de la API; cambios revertidos.");
} finally {
  try { if (client) await client.query("ROLLBACK"); } finally { client?.release(); await pool.end(); }
}
