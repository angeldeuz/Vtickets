"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const base = process.env.VTICKETS_API_URL || "http://127.0.0.1:3001/api/v1";
type Selection = { ticketTypeId: string; quantity: number }[];
export type ReserveResult = { ok: false; message: string; fields: Record<string, string>; reservationId?: string } | { ok: true; purchaseId: string };

async function accessToken(): Promise<string | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const claims = await supabase.auth.getClaims();
  if (!claims.data?.claims) return null;
  const session = await supabase.auth.getSession();
  return session.data.session?.access_token ?? null;
}

async function api(path: string, token: string, body: unknown, key: string) {
  const response = await fetch(`${base}${path}`, {
    method: "POST", cache: "no-store",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "Idempotency-Key": key },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) {
    const message = typeof data?.error?.message === "string" ? data.error.message : "No se pudo preparar la compra.";
    throw new Error(message);
  }
  return data;
}

// La sesión y el precio se verifican en NestJS. El navegador solo envía IDs y cantidades.
export async function reserveAndCheckout(eventId: string, selection: Selection, key: string, reservationId?: string): Promise<ReserveResult> {
  const fields: Record<string, string> = {};
  if (!/^[0-9a-f-]{36}$/i.test(eventId)) fields.items = "Evento no válido.";
  if (!Array.isArray(selection) || selection.length < 1 || selection.length > 4 ||
      selection.some((item) => !/^[0-9a-f-]{36}$/i.test(item.ticketTypeId) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 4) ||
      selection.reduce((sum, item) => sum + item.quantity, 0) > 4 || new Set(selection.map((item) => item.ticketTypeId)).size !== selection.length) {
    fields.items = "Elige entre 1 y 4 entradas válidas.";
  }
  if (!/^[a-zA-Z0-9._~-]{8,128}$/.test(key)) fields.items = "La solicitud no es válida. Intenta de nuevo.";
  if (Object.keys(fields).length) return { ok: false, message: "Revisa las entradas seleccionadas.", fields };
  const token = await accessToken();
  if (!token) return { ok: false, message: "Ingresa a tu cuenta para reservar.", fields: {} };
  let heldId = reservationId;
  try {
    if (!heldId) {
      const reserved = await api("/reservations", token, { eventId, items: selection }, `reserve-${key}`);
      heldId = reserved.id;
    }
    const checkout = await api(`/reservations/${heldId}/checkout`, token, {}, `checkout-${key}`);
    return { ok: true, purchaseId: checkout.purchaseId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo preparar la compra.";
    const itemError = /entrada|límite|agot|disponib|venta|reserv/i.test(message);
    return { ok: false, message, fields: itemError ? { items: message } : {}, reservationId: heldId };
  }
}

export async function cancelReservation(reservationId: string): Promise<void> {
  const released = await releaseReservation(reservationId);
  if (released) redirect("/eventos");
  throw new Error("No se pudo liberar la reserva. Intenta de nuevo.");
}

export async function releaseReservation(reservationId: string): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(reservationId)) return false;
  const token = await accessToken();
  if (!token) return false;
  const response = await fetch(`${base}/reservations/${reservationId}`, {
    method: "DELETE", cache: "no-store", headers: { Authorization: `Bearer ${token}` },
  });
  return response.ok;
}
