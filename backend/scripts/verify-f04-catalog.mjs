import { randomUUID } from "node:crypto";
import pg from "pg";

// Verifica permisos y restricciones con el rol de la API; siempre revierte los datos temporales.
try { process.loadEnvFile(".env"); } catch { /* CI puede pasar DATABASE_URL directamente. */ }
if (!process.env.DATABASE_URL) throw new Error("Configura DATABASE_URL para verificar el catálogo");

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 5000 });
let client;
const slug = `f04-${randomUUID()}`;
try {
  client = await pool.connect();
  await client.query("BEGIN");
  const category = await client.query(
    "INSERT INTO tickets_app.categorias (name, slug) VALUES ($1, $2) RETURNING id, is_active",
    ["Categoría temporal", slug],
  );
  const venue = await client.query(
    "INSERT INTO tickets_app.ubicaciones (name, city, country_code, timezone, capacity) VALUES ($1, $2, $3, $4, $5) RETURNING id, capacity",
    ["Recinto temporal", "Saltillo", "MX", "America/Monterrey", 100],
  );
  await client.query("UPDATE tickets_app.categorias SET is_active = false WHERE id = $1", [category.rows[0].id]);
  await client.query("UPDATE tickets_app.ubicaciones SET capacity = 120 WHERE id = $1", [venue.rows[0].id]);
  const categoryRead = await client.query("SELECT is_active FROM tickets_app.categorias WHERE id = $1", [category.rows[0].id]);
  const venueRead = await client.query("SELECT capacity FROM tickets_app.ubicaciones WHERE id = $1", [venue.rows[0].id]);
  if (categoryRead.rows[0]?.is_active !== false || venueRead.rows[0]?.capacity !== 120) {
    throw new Error("La lectura no refleja los cambios del catálogo");
  }
  console.log("F04-T01: INSERT, UPDATE y SELECT permitidos en categorías y ubicaciones.");
} finally {
  try { if (client) await client.query("ROLLBACK"); } finally { client?.release(); await pool.end(); }
}
