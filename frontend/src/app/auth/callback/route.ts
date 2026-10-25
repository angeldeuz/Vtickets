import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfig } from "@/lib/supabase/config";

// Algunos enlaces PKCE devuelven un código; nunca redirigimos a una URL externa.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const config = supabaseConfig();
  if (config && code) {
    const next = request.nextUrl.searchParams.get("next");
    const path = next === "/actualizar-contrasena" ? next : "/cuenta";
    const response = NextResponse.redirect(new URL(path, request.url));
    const supabase = createServerClient(config.url, config.key, {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        // El intercambio PKCE debe adjuntar la sesión a esta respuesta de redirección.
        setAll(items) {
          items.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    });
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return response;
  }
  return NextResponse.redirect(new URL("/ingresar?estado=enlace-invalido", request.url));
}
