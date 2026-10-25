import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Next.js 16 ejecuta este proxy antes de las rutas que podrían leer una sesión.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = { matcher: ["/cuenta/:path*", "/ingresar", "/registro", "/recuperar", "/actualizar-contrasena", "/auth/:path*"] };
