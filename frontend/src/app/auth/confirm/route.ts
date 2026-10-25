import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfig } from "@/lib/supabase/config";

// El correo de confirmación puede enviar token_hash; se canjea en servidor por una sesión.
export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const config = supabaseConfig();
  if (config && tokenHash && (type === "email" || type === "recovery" || type === "signup")) {
    const response = NextResponse.redirect(new URL(type === "recovery" ? "/actualizar-contrasena" : "/cuenta", request.url));
    const supabase = createServerClient(config.url, config.key, {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(items) {
          items.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    });
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as EmailOtpType });
    if (!error) return response;
  }
  return NextResponse.redirect(new URL("/ingresar?estado=enlace-invalido", request.url));
}
