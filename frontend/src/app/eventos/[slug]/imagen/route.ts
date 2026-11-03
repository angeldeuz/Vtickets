import { NextResponse } from "next/server";

// El navegador pide la portada a Next.js. Solo el servidor conoce la URL de la
// API; NestJS comprueba que el evento está publicado antes de leer Storage.
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const apiUrl = process.env.VTICKETS_API_URL?.trim() || "http://127.0.0.1:3001/api/v1";
  try {
    const response = await fetch(`${apiUrl.replace(/\/$/, "")}/public/events/${encodeURIComponent(slug)}/cover`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!response.ok) return new NextResponse(null, { status: response.status === 404 ? 404 : 502 });
    return new NextResponse(response.body, { headers: {
      "Content-Type": response.headers.get("content-type") ?? "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=60",
    } });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
