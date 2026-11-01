import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import pg from "pg";

// Ensaya la migración en Vtickets-pruebas dentro de una transacción reversible.
try { process.loadEnvFile("../database/.env.pruebas"); } catch { /* CI puede pasar las variables. */ }
try { process.loadEnvFile(".env"); } catch { /* CI puede pasar las variables. */ }
const url = process.env.TEST_DATABASE_URL;
const expectedRef = process.env.TEST_PROJECT_REF;
const devRef = new URL(process.env.SUPABASE_URL).hostname.split(".")[0];
if (!url || !expectedRef) throw new Error("Configura TEST_DATABASE_URL y TEST_PROJECT_REF");
const address = new URL(url);
const actualRef = /^db\.([a-z0-9]+)\.supabase\.co$/.exec(address.hostname)?.[1]
  ?? /^postgres\.([a-z0-9]+)$/.exec(decodeURIComponent(address.username))?.[1];
assert.equal(actualRef, expectedRef, "La conexión no corresponde al proyecto de pruebas");
assert.notEqual(actualRef, devRef, "La conexión apunta al proyecto de desarrollo");

const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 10_000 });
try {
  await client.connect();
  const role = (await client.query("SELECT current_user AS name")).rows[0].name;
  assert.equal(role, "postgres", "Se necesita la cuenta administrativa de pruebas");
  await client.query("BEGIN");
  const sql = await readFile(new URL("../../database/migrations/20261031004905_grant_event_images_delete.sql", import.meta.url), "utf8");
  await client.query(sql);
  const result = await client.query("SELECT has_table_privilege('tickets_app_runtime', 'tickets_app.evento_imagenes', 'DELETE') AS allowed");
  assert.equal(result.rows[0].allowed, true);
  console.log("F04-T03: GRANT DELETE verificado en Vtickets-pruebas; transacción revertida.");
} finally {
  try { await client.query("ROLLBACK"); } finally { await client.end(); }
}
