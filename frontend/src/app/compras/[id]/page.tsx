import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { cancelReservation } from "@/app/eventos/[slug]/reservation-actions";
import { ReservationCountdown } from "./reservation-countdown";

const base = process.env.VTICKETS_API_URL || "http://127.0.0.1:3001/api/v1";
type Purchase = { id: string; reservationId: string; status: string; expiresAt: string; currency: string; totalCents: number;
  items: { ticketTypeId: string; name: string; quantity: number; unitPriceCents: number; lineTotalCents: number }[] };
const money = (cents: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(cents / 100);
export const metadata: Metadata = { title: "Resumen de compra" };

export default async function PurchasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  if (!supabase) redirect(`/ingresar?next=/compras/${id}`);
  const claims = await supabase.auth.getClaims();
  if (!claims.data?.claims) redirect(`/ingresar?next=/compras/${id}`);
  const session = await supabase.auth.getSession();
  if (!session.data.session?.access_token) redirect(`/ingresar?next=/compras/${id}`);
  const response = await fetch(`${base}/purchases/${id}`, { cache: "no-store", headers: { Authorization: `Bearer ${session.data.session.access_token}` } });
  if (response.status === 404) notFound();
  if (!response.ok) return <div className="container purchase-page"><h1>No se pudo cargar la compra</h1><p>Intenta actualizar la página.</p></div>;
  const purchase = await response.json() as Purchase;
  const active = purchase.status === "awaiting_payment";
  const cancel = cancelReservation.bind(null, purchase.reservationId);
  return <div className="container purchase-page">
    <Link className="back-link" href="/eventos">Volver a eventos</Link>
    <h1>Resumen de compra</h1>
    <p className="purchase-state">{active ? "Pendiente de pago" : purchase.status === "cancelled" ? "Reserva vencida o cancelada" : purchase.status}</p>
    {active ? <ReservationCountdown expiresAt={purchase.expiresAt} /> : null}
    <div className="purchase-lines">
      {purchase.items.map((item) => <div className="purchase-line" key={item.ticketTypeId}>
        <div><strong>{item.name}</strong><span>{item.quantity} × {money(item.unitPriceCents)}</span></div><strong>{money(item.lineTotalCents)}</strong>
      </div>)}
    </div>
    <div className="purchase-total"><span>Total fijado en {purchase.currency}</span><strong>{money(purchase.totalCents)}</strong></div>
    {active ? <><p>Tu reserva está lista. El pago se habilitará en la fase 7; aún no se ha cobrado ni emitido ningún ticket.</p>
      <form action={cancel}><button className="button button-dark" type="submit">Cancelar y liberar entradas</button></form></> :
      <p>Esta compra ya no acepta pagos. Puedes elegir otras entradas disponibles.</p>}
  </div>;
}
