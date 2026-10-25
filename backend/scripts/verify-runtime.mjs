import process from "node:process";
import pg from "pg";

// Comprueba la cuenta de aplicación real sin imprimir credenciales.
try { process.loadEnvFile(".env"); } catch { /* CI puede pasar DATABASE_URL como variable. */ }
if (!process.env.DATABASE_URL) throw new Error("Configura DATABASE_URL antes de verificar el rol");

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 5000 });
try {
  const { rows } = await pool.query(`
    SELECT current_user AS role,
      has_schema_privilege(current_user, 'tickets_app', 'USAGE') AS business_schema,
      has_table_privilege(current_user, 'tickets_app.usuarios', 'SELECT') AS business_read,
      has_table_privilege(current_user, 'tickets_app.usuarios', 'INSERT') AS business_insert,
      has_schema_privilege(current_user, 'auth', 'USAGE') AS auth_schema,
      has_schema_privilege(current_user, 'public', 'CREATE') AS public_create
  `);
  const row = rows[0];
  if (!row || !row.business_schema || !row.business_read || !row.business_insert || row.auth_schema || row.public_create) {
    throw new Error("La cuenta de aplicación tiene privilegios incompletos o excesivos");
  }
  try {
    await pool.query("SELECT 1 FROM auth.users LIMIT 1");
    throw new Error("La cuenta de aplicación pudo leer auth.users");
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "42501") throw error;
  }
  console.log(`Rol ${row.role}: acceso de negocio confirmado; auth.users y CREATE en public denegados.`);
} finally {
  await pool.end();
}
