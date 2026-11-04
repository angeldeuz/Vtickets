"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Event } from "@/lib/events";
import { formatMoney } from "@/lib/events";
import { releaseReservation, reserveAndCheckout } from "./reservation-actions";

export function TicketSelection({ event }: { event: Event }) {
  const router = useRouter();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [error, setError] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [pending, startTransition] = useTransition();
  const firstField = useRef<HTMLSelectElement>(null);
  const requestKey = useRef<string | null>(null);
  const heldId = useRef<string | undefined>(undefined);
  const total = event.tickets.reduce((sum, ticket) => sum + ticket.price * (quantities[ticket.id] ?? 0), 0);
  const count = Object.values(quantities).reduce((sum, value) => sum + value, 0);
  const firstAvailable = event.tickets.findIndex((ticket) => ticket.saleStatus === "available" && ticket.available > 0);

  function change(id: string, quantity: number) {
    const previousHold = heldId.current;
    setQuantities((previous) => ({ ...previous, [id]: quantity }));
    setError(""); setFieldError("");
    requestKey.current = null;
    heldId.current = undefined;
    if (previousHold) startTransition(async () => {
      if (!await releaseReservation(previousHold)) setError("No se pudo liberar la reserva anterior; vencerá automáticamente.");
    });
  }

  function submit(eventSubmit: React.FormEvent<HTMLFormElement>) {
    eventSubmit.preventDefault();
    if (count < 1 || count > 4) {
      setFieldError("Elige entre 1 y 4 entradas en total."); firstField.current?.focus(); return;
    }
    const selection = event.tickets.filter((ticket) => (quantities[ticket.id] ?? 0) > 0)
      .map((ticket) => ({ ticketTypeId: ticket.id, quantity: quantities[ticket.id] }));
    requestKey.current ??= crypto.randomUUID();
    startTransition(async () => {
      const result = await reserveAndCheckout(event.id, selection, requestKey.current!, heldId.current);
      if (result.ok) { router.push(`/compras/${result.purchaseId}`); return; }
      if (/ya no está vigente|ya venció|expir/i.test(result.message)) {
        heldId.current = undefined; requestKey.current = null;
      } else heldId.current = result.reservationId;
      setError(result.message); setFieldError(result.fields.items ?? "");
      if (result.fields.items) firstField.current?.focus();
    });
  }

  return <form className="ticket-selection" onSubmit={submit} noValidate>
    <div className="ticket-options">
      {event.tickets.map((ticket, index) => {
        const canBuy = ticket.saleStatus === "available" && ticket.available > 0;
        const max = canBuy ? Math.min(4, ticket.available, ticket.maxPerOrder, ticket.maxPerUser) : 0;
        return <div className="ticket-option" key={ticket.id}>
          <div><strong>{ticket.name}</strong>{ticket.description ? <small>{ticket.description}</small> : null}
            <span>{canBuy ? `${ticket.available} lugares disponibles` : ticket.saleStatus === "upcoming" ? "Venta próximamente" : ticket.saleStatus === "closed" ? "Venta finalizada" : "Agotado"}</span>
            {canBuy ? <label className="ticket-quantity">Cantidad
              <select ref={index === firstAvailable ? firstField : undefined} value={quantities[ticket.id] ?? 0} disabled={pending}
                onChange={(changeEvent) => change(ticket.id, Number(changeEvent.target.value))}
                aria-invalid={Boolean(fieldError)} aria-describedby={fieldError ? "ticket-selection-error" : undefined}>
                {Array.from({ length: max + 1 }, (_, quantity) => <option key={quantity} value={quantity}>{quantity}</option>)}
              </select>
            </label> : null}
          </div><strong>{formatMoney(ticket.price)}</strong>
        </div>;
      })}
    </div>
    {fieldError ? <p id="ticket-selection-error" className="field-error" role="alert">{fieldError}</p> : null}
    <div className="ticket-total"><span>Total estimado · {count} {count === 1 ? "entrada" : "entradas"}</span><strong>{formatMoney(total)}</strong></div>
    {error && !fieldError ? <p className="field-error" role="alert">{error}</p> : null}
    {error.includes("Ingresa") ? <Link className="text-link" href={`/ingresar?next=/eventos/${encodeURIComponent(event.slug)}`}>Iniciar sesión</Link> : null}
    <button className="button button-coral" type="submit" disabled={pending || !event.tickets.some((ticket) => ticket.saleStatus === "available")}>
      {pending ? "Preparando compra…" : "Reservar entradas"}
    </button>
    <p className="panel-note">La reserva dura 10 minutos. El pago se habilitará en la siguiente fase.</p>
  </form>;
}
