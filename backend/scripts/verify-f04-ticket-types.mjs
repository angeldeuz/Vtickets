import { randomUUID } from "node:crypto";
import pg from "pg";

// Comprueba los permisos reales del rol de API y revierte todos los datos temporales.
try { process.loadEnvFile(".env"); } catch { /* CI puede pasar DATABASE_URL directamente. */ }
if (!process.env.DATABASE_URL) throw new Error("Configura DATABASE_URL");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 5000 });
let client;
try {
  client = await pool.connect();
  await client.query("BEGIN");
  const organizer = await client.query("SELECT id FROM tickets_app.usuarios WHERE status = 'active' LIMIT 1");
  if (!organizer.rows[0]) throw new Error("Se necesita un usuario activo de desarrollo");
  const category = await client.query("INSERT INTO tickets_app.categorias (name, slug) VALUES ($1, $2) RETURNING id", ["Categoría temporal", `f04-${randomUUID()}`]);
  const venue = await client.query("INSERT INTO tickets_app.ubicaciones (name, timezone, capacity) VALUES ($1, $2, $3) RETURNING id", ["Recinto temporal", "America/Mexico_City", 100]);
  const event = await client.query(
    `INSERT INTO tickets_app.eventos (category_id, venue_id, organizer_id, title, slug, starts_at, ends_at, timezone, capacity_limit)
     VALUES ($1, $2, $3, 'Evento temporal', $4, '2031-01-01T18:00:00Z', '2031-01-01T23:00:00Z', 'America/Mexico_City', 100) RETURNING id`,
    [category.rows[0].id, venue.rows[0].id, organizer.rows[0].id, `f04-${randomUUID()}`],
  );
  const ticket = await client.query(
    `INSERT INTO tickets_app.tipos_ticket (event_id, name, price_cents, quantity_total, max_per_order, max_per_user)
     VALUES ($1, 'General', 25000, 50, 4, 4) RETURNING id, price_cents`, [event.rows[0].id],
  );
  await client.query("INSERT INTO tickets_app.inventarios (ticket_type_id) VALUES ($1)", [ticket.rows[0].id]);
  const changed = await client.query(
    "UPDATE tickets_app.tipos_ticket SET quantity_total = 60 WHERE id = $1 RETURNING quantity_total", [ticket.rows[0].id],
  );
  const inventory = await client.query("SELECT reserved_count, sold_count FROM tickets_app.inventarios WHERE ticket_type_id = $1", [ticket.rows[0].id]);
  if (changed.rows[0]?.quantity_total !== 60 || ticket.rows[0]?.price_cents !== "25000" ||
      inventory.rows[0]?.reserved_count !== 0 || inventory.rows[0]?.sold_count !== 0) {
    throw new Error("El tipo o su inventario no se guardaron como se esperaba");
  }
  console.log("F04-T04: tipo, precio, stock e inventario verificados con el rol de API; cambios revertidos.");
} finally {
  try { if (client) await client.query("ROLLBACK"); } finally { client?.release(); await pool.end(); }
}
