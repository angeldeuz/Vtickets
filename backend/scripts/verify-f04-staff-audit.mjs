import { randomUUID } from "node:crypto";
import pg from "pg";

try { process.loadEnvFile(".env"); } catch { /* CI puede pasar DATABASE_URL directamente. */ }
if (!process.env.DATABASE_URL) throw new Error("Configura DATABASE_URL");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 5000 });
let client;
try {
  client = await pool.connect(); await client.query("BEGIN");
  const organizer = await client.query("SELECT id FROM tickets_app.usuarios WHERE status = 'active' LIMIT 1");
  const role = await client.query("SELECT id FROM tickets_app.roles WHERE code = 'ACCESO' LIMIT 1");
  if (!organizer.rows[0] || !role.rows[0]) throw new Error("Se necesitan un usuario activo y el rol ACCESO");
  const category = await client.query("INSERT INTO tickets_app.categorias (name, slug) VALUES ($1, $2) RETURNING id", ["Categoría temporal", `f04-${randomUUID()}`]);
  const venue = await client.query("INSERT INTO tickets_app.ubicaciones (name, timezone, capacity) VALUES ($1, $2, 100) RETURNING id", ["Recinto temporal", "America/Mexico_City"]);
  const event = await client.query(
    `INSERT INTO tickets_app.eventos (category_id, venue_id, organizer_id, title, slug, starts_at, ends_at, timezone, capacity_limit)
     VALUES ($1, $2, $3, 'Evento temporal', $4, '2031-01-01T18:00:00Z', '2031-01-01T23:00:00Z', 'America/Mexico_City', 100) RETURNING id`,
    [category.rows[0].id, venue.rows[0].id, organizer.rows[0].id, `f04-${randomUUID()}`],
  );
  const staff = await client.query(
    "INSERT INTO tickets_app.personal_eventos (event_id, user_id, role_id, assigned_by) VALUES ($1, $2, $3, $2) RETURNING id",
    [event.rows[0].id, organizer.rows[0].id, role.rows[0].id],
  );
  await client.query("UPDATE tickets_app.personal_eventos SET status = 'withdrawn' WHERE id = $1", [staff.rows[0].id]);
  const audit = await client.query(
    "INSERT INTO tickets_app.auditoria (actor_user_id, action, entity_name, entity_id, metadata) VALUES ($1, 'staff.withdrawn', 'personal_evento', $2, $3::jsonb) RETURNING id",
    [organizer.rows[0].id, staff.rows[0].id, JSON.stringify({ eventId: event.rows[0].id })],
  );
  const current = await client.query("SELECT status FROM tickets_app.personal_eventos WHERE id = $1", [staff.rows[0].id]);
  if (current.rows[0]?.status !== "withdrawn" || !audit.rows[0]?.id) throw new Error("Asignación o auditoría no verificadas");
  console.log("F04-T06/T07: asignación, retiro y auditoría verificados con el rol de API; cambios revertidos.");
} finally {
  try { if (client) await client.query("ROLLBACK"); } finally { client?.release(); await pool.end(); }
}
