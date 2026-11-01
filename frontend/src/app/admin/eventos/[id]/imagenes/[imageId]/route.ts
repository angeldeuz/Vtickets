import { createClient } from "@/lib/supabase/server";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const base = process.env.VTICKETS_API_URL || "http://127.0.0.1:3001/api/v1";

// La imagen permanece privada en Storage. Esta ruta verifica la sesión y deja que la API compruebe el rol.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; imageId: string }> }) {
  const { id, imageId } = await params;
  if (!uuid.test(id) || !uuid.test(imageId)) return new Response(null, { status: 404 });
  const supabase = await createClient();
  if (!supabase) return new Response(null, { status: 401 });
  const claims = await supabase.auth.getClaims();
  if (!claims.data?.claims) return new Response(null, { status: 401 });
  const session = await supabase.auth.getSession();
  const accessToken = session.data.session?.access_token;
  if (!accessToken) return new Response(null, { status: 401 });
  try {
    const response = await fetch(`${base}/admin/events/${id}/images/${imageId}/content`, {
      headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store",
    });
    if (!response.ok) return new Response(null, { status: response.status, headers: { "Cache-Control": "private, no-store" } });
    const mime = response.headers.get("content-type") ?? "";
    if (!["image/png", "image/jpeg", "image/webp"].includes(mime)) return new Response(null, { status: 502 });
    return new Response(response.body, { headers: { "Content-Type": mime, "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox" } });
  } catch { return new Response(null, { status: 502, headers: { "Cache-Control": "private, no-store" } }); }
}
