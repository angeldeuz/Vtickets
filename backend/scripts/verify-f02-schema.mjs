import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();

async function runFile(path) {
  const sql = await readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
  await db.exec(sql);
}

async function runBootstrap(authUserId) {
  const sql = await readFile(new URL('../../database/scripts/bootstrap_admin.psql', import.meta.url), 'utf8');
  // PGlite no interpreta metacomandos de psql; se sustituye solo el parámetro.
  const executable = sql.replace(/^\\.*$/gm, '').replaceAll(":'auth_user_id'", `'${authUserId}'`);
  await db.exec(executable);
}

async function scalar(sql) {
  const result = await db.query(sql);
  return Object.values(result.rows[0])[0];
}

async function expectSqlError(sql, code) {
  await assert.rejects(db.query(sql), (error) => error.code === code);
}

try {
  // Solo representa la clave externa requerida por el esquema de negocio.
  await db.exec('CREATE SCHEMA auth; CREATE TABLE auth.users (id uuid PRIMARY KEY);');
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated;');
  await runFile('database/baseline/20261025_tickets_app_snapshot.sql');
  assert.equal(Number(await scalar("SELECT count(*) FROM pg_tables WHERE schemaname = 'tickets_app'")), 24);
  await runFile('database/migrations/20261025204118_align_f02_business_rules_20261025.sql');
  await runFile('database/seeds/roles.sql');
  await runFile('database/seeds/roles.sql');
  await runFile('database/seeds/development.sql');
  await runFile('database/seeds/development.sql');
  assert.equal(Number(await scalar('SELECT count(*) FROM tickets_app.roles')), 3);
  assert.equal(Number(await scalar("SELECT count(*) FROM tickets_app.categorias WHERE slug = 'musica-prueba'")), 1);
  assert.equal(Number(await scalar("SELECT count(*) FROM tickets_app.ubicaciones WHERE id = '10000000-0000-0000-0000-000000000002'")), 1);
  assert.equal(Number(await scalar("SELECT count(*) FROM information_schema.columns WHERE table_schema = 'tickets_app'")), 223);
  assert.equal(Number(await scalar("SELECT count(*) FROM pg_tables WHERE schemaname = 'tickets_app' AND rowsecurity")), 24);
  assert.equal(Number(await scalar("SELECT count(*) FROM pg_policies WHERE schemaname = 'tickets_app'")), 24);
  assert.equal(await scalar("SELECT has_schema_privilege('anon', 'tickets_app', 'USAGE')"), false);
  assert.equal(await scalar("SELECT has_schema_privilege('authenticated', 'tickets_app', 'USAGE')"), false);
  assert.equal(await scalar("SELECT has_table_privilege('tickets_app_runtime', 'tickets_app.roles', 'UPDATE')"), false);
  assert.equal(await scalar("SELECT has_table_privilege('tickets_app_runtime', 'tickets_app.accesos', 'UPDATE')"), false);
  assert.equal(await scalar("SELECT has_table_privilege('tickets_app_runtime', 'tickets_app.historial_escaneos', 'UPDATE')"), false);
  assert.equal(await scalar("SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'tickets_app' AND indexname = 'reembolsos_payment_provider_refund_id_idx')"), true);
  assert.equal(await scalar("SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'tickets_app' AND indexname = 'eventos_category_id_idx')"), false);
  assert.equal(await scalar("SELECT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reembolsos_ticket_id_purchase_id_fkey')"), true);
  assert.equal(await scalar("SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'events_venue_id_fkey'"), 'FOREIGN KEY (venue_id) REFERENCES tickets_app.ubicaciones(id) ON DELETE RESTRICT');

  await db.exec(`
    INSERT INTO auth.users (id) VALUES ('00000000-0000-0000-0000-000000000001');
    INSERT INTO tickets_app.usuarios (id, auth_user_id)
      VALUES ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001');
    INSERT INTO tickets_app.categorias (id, name, slug)
      VALUES ('00000000-0000-0000-0000-000000000003', 'Prueba', 'prueba');
    INSERT INTO tickets_app.ubicaciones (id, name, timezone)
      VALUES ('00000000-0000-0000-0000-000000000004', 'Prueba', 'America/Monterrey');
    INSERT INTO tickets_app.eventos
      (id, category_id, venue_id, organizer_id, title, slug, starts_at, ends_at, capacity_limit, timezone, status)
      VALUES ('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000003',
        '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002',
        'Evento de prueba', 'evento-prueba', '2027-01-01T12:00:00Z', '2027-01-01T14:00:00Z', 20,
        'America/Monterrey', 'suspended');
    INSERT INTO tickets_app.tipos_ticket (event_id, name, quantity_total)
      VALUES ('00000000-0000-0000-0000-000000000005', 'General', 20);
  `);
  await runBootstrap('00000000-0000-0000-0000-000000000001');
  await runBootstrap('00000000-0000-0000-0000-000000000001');
  assert.equal(Number(await scalar("SELECT count(*) FROM tickets_app.usuario_roles ur JOIN tickets_app.roles r ON r.id = ur.role_id WHERE ur.user_id = '00000000-0000-0000-0000-000000000002' AND r.code = 'ADMINISTRADOR'")), 1);
  assert.equal(Number(await scalar("SELECT count(*) FROM tickets_app.auditoria WHERE action = 'bootstrap_admin'")), 1);
  assert.equal(Number(await scalar("SELECT max_per_order FROM tickets_app.tipos_ticket WHERE name = 'General'")), 4);
  await expectSqlError("UPDATE tickets_app.tipos_ticket SET max_per_order = 5 WHERE name = 'General'", '23514');
  await expectSqlError("DELETE FROM tickets_app.ubicaciones WHERE id = '00000000-0000-0000-0000-000000000004'", '23001');
  await expectSqlError("UPDATE tickets_app.eventos SET timezone = '' WHERE slug = 'evento-prueba'", '23514');
  console.log('F02: línea base, migración, semillas, alta inicial simulada, catálogo, permisos y restricciones verificados en PGlite.');

  if (process.argv.includes('--inspect')) {
    const views = [
      ['Tablas de tickets_app', "SELECT tablename AS tabla FROM pg_tables WHERE schemaname = 'tickets_app' ORDER BY tablename"],
      ['Roles', 'SELECT code AS codigo, name AS nombre FROM tickets_app.roles ORDER BY code'],
      ['Categorías de prueba', 'SELECT name AS nombre, slug FROM tickets_app.categorias ORDER BY slug'],
      ['Ubicaciones de prueba', 'SELECT name AS nombre, city AS ciudad, timezone AS zona_horaria FROM tickets_app.ubicaciones ORDER BY name'],
      ['Eventos de prueba', 'SELECT title AS titulo, status AS estado, timezone AS zona_horaria FROM tickets_app.eventos ORDER BY title'],
    ];
    for (const [title, sql] of views) {
      console.log(`\n${title}`);
      console.table((await db.query(sql)).rows);
    }
  }
} finally {
  await db.close();
}
