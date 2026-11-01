import pg from "pg";

// Comprueba la configuración local sin imprimir claves ni cadenas de conexión.
try { process.loadEnvFile(".env"); } catch { /* Falta el archivo local. */ }
try { process.loadEnvFile("../database/.env.desarrollo"); } catch { /* Falta el archivo local. */ }
try { process.loadEnvFile("../database/.env.pruebas"); } catch { /* El proyecto de pruebas es opcional. */ }

const projectUrl = process.env.SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
const adminUrl = process.env.DEV_ADMIN_DATABASE_URL;
if (!projectUrl || !secret || !adminUrl) {
  const missing = [!projectUrl && "SUPABASE_URL", !secret && "SUPABASE_SECRET_KEY", !adminUrl && "DEV_ADMIN_DATABASE_URL"].filter(Boolean);
  throw new Error(`Faltan variables locales: ${missing.join(", ")}`);
}
if (!secret.startsWith("sb_secret_")) throw new Error("SUPABASE_SECRET_KEY debe ser una clave sb_secret_ del proyecto");

const expectedRef = new URL(projectUrl).hostname.split(".")[0];
const address = new URL(adminUrl);
const actualRef = /^db\.([a-z0-9]+)\.supabase\.co$/.exec(address.hostname)?.[1]
  ?? /^postgres\.([a-z0-9]+)$/.exec(decodeURIComponent(address.username))?.[1];
if (actualRef && actualRef === process.env.TEST_PROJECT_REF) throw new Error("DEV_ADMIN_DATABASE_URL apunta a Vtickets-pruebas; usa la conexión del proyecto de desarrollo");
if (!actualRef || actualRef !== expectedRef) throw new Error("La conexión administrativa no apunta al mismo proyecto que SUPABASE_URL");
if (address.port === "6543") throw new Error("Usa conexión directa o Session pooler (5432), no Transaction pooler (6543)");

const client = new pg.Client({ connectionString: adminUrl, connectionTimeoutMillis: 10_000 });
try {
  try {
    await client.connect();
  } catch (error) {
    if (error?.code === "28P01") throw new Error("PostgreSQL rechazó la contraseña de postgres del proyecto de desarrollo");
    throw error;
  }
  const role = (await client.query("SELECT current_user AS name")).rows[0].name;
  if (role !== "postgres") throw new Error("La conexión administrativa debe usar el rol postgres");
  const migration = await client.query("SELECT to_regclass('supabase_migrations.schema_migrations') IS NOT NULL AS exists");
  if (!migration.rows[0].exists) throw new Error("Este proyecto no tiene el historial de migraciones esperado");
  console.log("F04-T03: proyecto, clave y conexión administrativa locales verificados sin mostrar credenciales.");
} finally {
  await client.end();
}
