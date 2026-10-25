import { createBrowserClient } from "@supabase/ssr";
import { supabaseConfig } from "./config";

// Este cliente se ejecuta en el navegador; solo recibe la clave publicable de Supabase.
export function createClient() {
  const config = supabaseConfig();
  if (!config) throw new Error("Supabase Auth no está configurado");
  return createBrowserClient(config.url, config.key);
}
