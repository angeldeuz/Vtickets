import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { collectPages } from "./paginated-list";

const base = process.env.VTICKETS_API_URL || "http://127.0.0.1:3001/api/v1";

export type AdminEvent = { id: string; title: string; slug: string; status: string; startsAt: string; endsAt: string;
  timezone: string; capacityLimit: number; categoryId: string; venueId: string; summary: string | null;
  description: string | null; salesStartsAt: string | null; salesEndsAt: string | null; updatedAt: string };
export type AdminTicket = { id: string; eventId: string; name: string; description: string | null; priceCents: number;
  currency: string; quantityTotal: number; maxPerOrder: number; maxPerUser: number; status: string;
  salesStartsAt: string | null; salesEndsAt: string | null; updatedAt: string;
  inventory: { reservedCount: number; soldCount: number } | null };
export type AdminStaff = { id: string; userId: string; status: string; startsAt: string | null; endsAt: string | null;
  refUserId: { fullName: string | null; phone: string | null } };
export type AdminImage = { id: string; altText: string | null; isCover: boolean; sortOrder: number };
export type Page<T> = { items: T[]; nextCursor: string | null };

export async function adminFetchAll<T>(path: string): Promise<T[]> {
  return collectPages((cursor) => {
    const query = `limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
    return adminFetch<Page<T>>(`${path}${path.includes("?") ? "&" : "?"}${query}`);
  });
}

export class AdminApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly fields: Record<string, string> = {}) {
    super(message);
    this.name = "AdminApiError";
  }
}

const token = cache(async () => {
  const supabase = await createClient();
  if (!supabase) redirect("/ingresar");
  const claims = await supabase.auth.getClaims();
  if (!claims.data?.claims) redirect("/ingresar");
  const session = await supabase.auth.getSession();
  if (!session.data.session?.access_token) redirect("/ingresar");
  return session.data.session.access_token;
});

export async function adminFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const accessToken = await token();
  const response = await fetch(`${base}${path}`, {
    ...init, cache: "no-store",
    headers: { Authorization: `Bearer ${accessToken}`, ...(init.headers || {}) },
  });
  if (!response.ok) {
    let message = `La API respondió ${response.status}`;
    let fields: Record<string, string> = {};
    try {
      const body = await response.json() as { error?: { message?: unknown; details?: { fields?: unknown } }; message?: unknown };
      if (typeof body.error?.message === "string") message = body.error.message;
      else if (typeof body.message === "string") message = body.message;
      const candidate = body.error?.details?.fields;
      if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
        fields = Object.fromEntries(Object.entries(candidate).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
      }
    } catch { /* Se conserva el estado HTTP. */ }
    throw new AdminApiError(message, response.status, fields);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function requireAdmin() {
  const profile = await adminFetch<{ roles: string[] }>("/me");
  if (!profile.roles.includes("ADMINISTRADOR")) redirect("/cuenta");
}
