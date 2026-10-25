import { z } from "zod";

// Nest carga .env al arrancar; Zod rechaza una configuración inválida antes de atender solicitudes.
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  WEB_ORIGIN: z.url().default("http://localhost:3000"),
  SUPABASE_URL: z.union([z.url(), z.literal("")]).default(""),
  DATABASE_URL: z.union([z.url(), z.literal("")]).default(""),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(20).default(5),
});

export type AppEnv = z.infer<typeof envSchema>;

export function validateEnv(input: Record<string, unknown>): AppEnv {
  const result = envSchema.safeParse(input);
  if (!result.success) {
    const fields = result.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Configuración inválida: ${fields}`);
  }
  if (result.data.NODE_ENV === "production" && result.data.DATABASE_URL.includes("uselibpqcompat=true")) {
    throw new Error("En producción configura el certificado CA y verificación TLS completa de PostgreSQL");
  }
  return result.data;
}
