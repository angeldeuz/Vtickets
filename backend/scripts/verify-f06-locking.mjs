import assert from "node:assert/strict";
import pg from "pg";

try { process.loadEnvFile(".env"); } catch { /* CI puede proporcionar DATABASE_URL. */ }
if (!process.env.DATABASE_URL) throw new Error("Falta DATABASE_URL para la prueba de bloqueo");
const first = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
const second = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
await Promise.all([first.connect(), second.connect()]);
try {
  const chosen = await first.query("SELECT ticket_type_id FROM tickets_app.inventarios ORDER BY ticket_type_id LIMIT 1");
  if (!chosen.rows.length) throw new Error("Se necesita al menos un inventario existente para comprobar bloqueos");
  const id = chosen.rows[0].ticket_type_id;
  await first.query("BEGIN");
  await first.query("SELECT ticket_type_id FROM tickets_app.inventarios WHERE ticket_type_id = $1 FOR UPDATE", [id]);
  await second.query("BEGIN");
  await assert.rejects(second.query("SELECT ticket_type_id FROM tickets_app.inventarios WHERE ticket_type_id = $1 FOR UPDATE NOWAIT", [id]),
    (error) => error?.code === "55P03");
  console.log("F06 PostgreSQL: dos conexiones compiten por la misma fila de inventario; la segunda espera el bloqueo.");
} finally {
  await Promise.allSettled([first.query("ROLLBACK"), second.query("ROLLBACK")]);
  await Promise.allSettled([first.end(), second.end()]);
}
