import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseConfig } from "./config";

// Los Server Components leen cookies; las acciones y rutas también pueden renovarlas.
export async function createClient() {
  const config = supabaseConfig();
  if (!config) return null;
  const cookieStore = await cookies();
  return createServerClient(config.url, config.key, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(items) {
        try { items.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); }
        catch { /* Un Server Component no escribe cookies; proxy.ts renueva la sesión. */ }
      },
    },
  });
}
