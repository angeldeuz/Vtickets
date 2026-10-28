import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

const { Client } = pg;
const root = new URL('../../', import.meta.url);

function projectRefFromDatabaseUrl(value) {
  const url = new URL(value);
  const hostMatch = /^db\.([a-z0-9]+)\.supabase\.co$/.exec(url.hostname);
  if (hostMatch) return hostMatch[1];
  const userMatch = /^postgres\.([a-z0-9]+)$/.exec(decodeURIComponent(url.username));
  return userMatch?.[1] ?? null;
}

function key(row) { return JSON.stringify(row); }

async function catalog(client) {
  const queries = {
    tables: `SELECT c.relname AS name, c.relrowsecurity AS rls, c.relforcerowsecurity AS force_rls
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'tickets_app' AND c.relkind IN ('r', 'p') ORDER BY c.relname`,
    columns: `SELECT c.relname AS table_name, a.attname AS name,
        format_type(a.atttypid, a.atttypmod) AS data_type, a.attnotnull AS not_null,
        pg_get_expr(d.adbin, d.adrelid) AS default_value
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
      LEFT JOIN pg_attrdef d ON d.adrelid = c.oid AND d.adnum = a.attnum
      WHERE n.nspname = 'tickets_app' AND c.relkind IN ('r', 'p')
      ORDER BY c.relname, a.attnum`,
    constraints: `SELECT c.relname AS table_name, k.conname AS name,
        pg_get_constraintdef(k.oid, true) AS definition
      FROM pg_constraint k JOIN pg_class c ON c.oid = k.conrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'tickets_app' ORDER BY c.relname, k.conname`,
    indexes: `SELECT tablename AS table_name, indexname AS name, indexdef AS definition
      FROM pg_indexes WHERE schemaname = 'tickets_app' ORDER BY tablename, indexname`,
    policies: `SELECT tablename AS table_name, policyname AS name, permissive, roles, cmd, qual, with_check
      FROM pg_policies WHERE schemaname = 'tickets_app' ORDER BY tablename, policyname`,
    privileges: `SELECT t.tablename AS table_name, r.role_name, p.privilege,
        has_table_privilege(r.role_name, format('%I.%I', 'tickets_app', t.tablename), p.privilege) AS allowed
      FROM pg_tables t
      CROSS JOIN (VALUES ('anon'), ('authenticated'), ('tickets_app_runtime')) AS r(role_name)
      CROSS JOIN (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) AS p(privilege)
      WHERE t.schemaname = 'tickets_app'
      ORDER BY t.tablename, r.role_name, p.privilege`,
  };
  const result = {};
  for (const [name, sql] of Object.entries(queries)) result[name] = (await client.query(sql)).rows;
  result.schemaPrivileges = (await client.query(`SELECT role_name,
      has_schema_privilege(role_name, 'tickets_app', 'USAGE') AS usage
    FROM (VALUES ('anon'), ('authenticated'), ('tickets_app_runtime')) AS r(role_name)
    ORDER BY role_name`)).rows;
  result.roles = (await client.query('SELECT code, name, is_system FROM tickets_app.roles ORDER BY code')).rows;
  return result;
}

function compareCatalog(reference, restored) {
  let mismatches = 0;
  for (const section of Object.keys(reference)) {
    const expected = reference[section].map(key);
    const actual = restored[section].map(key);
    if (JSON.stringify(expected) === JSON.stringify(actual)) {
      console.log(`${section}: ${actual.length} objetos coinciden`);
      continue;
    }
    const onlyReference = expected.filter((row) => !actual.includes(row));
    const onlyRestored = actual.filter((row) => !expected.includes(row));
    console.error(`${section}: diferencias (${onlyReference.length} solo desarrollo, ${onlyRestored.length} solo pruebas)`);
    for (const row of onlyReference.slice(0, 3)) console.error(`  desarrollo: ${row}`);
    for (const row of onlyRestored.slice(0, 3)) console.error(`  pruebas: ${row}`);
    mismatches++;
  }
  assert.equal(mismatches, 0, 'El catálogo restaurado difiere del desarrollo');
}

const testUrl = process.env.TEST_DATABASE_URL;
const devUrl = process.env.DATABASE_URL;
const expectedRef = process.env.TEST_PROJECT_REF;
const devSupabaseUrl = process.env.SUPABASE_URL;
const apply = process.argv.includes('--apply');
const compare = process.argv.includes('--compare');
assert.equal(apply && compare, false, 'Usar --apply o --compare, no ambos');
if (!testUrl || !devUrl || !expectedRef || !devSupabaseUrl) {
  throw new Error('Faltan TEST_DATABASE_URL, TEST_PROJECT_REF, DATABASE_URL o SUPABASE_URL');
}

const actualRef = projectRefFromDatabaseUrl(testUrl);
assert.equal(actualRef, expectedRef, 'La conexión de pruebas no coincide con TEST_PROJECT_REF');
const devRef = new URL(devSupabaseUrl).hostname.split('.')[0];
assert.notEqual(actualRef, devRef, 'La conexión de pruebas apunta al proyecto de desarrollo');
assert.notEqual(testUrl, devUrl, 'Las conexiones de desarrollo y pruebas son iguales');

const development = new Client({ connectionString: devUrl, connectionTimeoutMillis: 10_000 });
const test = new Client({ connectionString: testUrl, connectionTimeoutMillis: 10_000 });
try {
  await development.connect();
  await test.connect();
  const identity = (await test.query('SELECT current_user AS role_name, current_database() AS database_name')).rows[0];
  assert.match(identity.role_name, /^postgres$/);
  const existing = (await test.query("SELECT to_regnamespace('tickets_app') IS NOT NULL AS exists")).rows[0].exists;
  assert.equal(existing, compare, compare
    ? 'tickets_app no existe en pruebas; falta aplicar la línea base'
    : 'tickets_app ya existe en pruebas; no se aplicará la línea base');
  const reference = await catalog(development);
  assert.equal(reference.tables.length, 24, 'El proyecto de desarrollo no tiene las 24 tablas esperadas');
  console.log(`Proyecto de pruebas ${expectedRef}: conexión administrativa verificada; esquema tickets_app ${existing ? 'presente' : 'ausente'}.`);
  if (compare) {
    compareCatalog(reference, await catalog(test));
    console.log('F02: el catálogo de pruebas sigue coincidiendo con desarrollo.');
  } else if (!apply) {
    console.log('Preflight correcto. Repite con --apply para restaurar y comparar.');
    process.exitCode = 0;
  } else {
    const files = [
      'database/baseline/20261025_tickets_app_snapshot.sql',
      'database/migrations/20261025204118_align_f02_business_rules_20261025.sql',
      'database/seeds/roles.sql',
    ];
    await test.query('BEGIN');
    try {
      await test.query("SET LOCAL statement_timeout = '60s'");
      for (const file of files) {
        const sql = await readFile(new URL(file, root), 'utf8');
        await test.query(sql);
        console.log(`Aplicado: ${file}`);
      }
      await test.query('COMMIT');
    } catch (error) {
      await test.query('ROLLBACK');
      throw error;
    }
    compareCatalog(reference, await catalog(test));
    console.log('F02: línea base, migración, roles, RLS y permisos coinciden con desarrollo.');
  }
} finally {
  await Promise.allSettled([development.end(), test.end()]);
}
