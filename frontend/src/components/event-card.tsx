import Link from "next/link";
import { ArrowUpRight, CalendarDays, MapPin } from "lucide-react";
import type { Event } from "@/lib/events";
import { formatDate, formatMoney } from "@/lib/events";

export function EventCard({ event }: { event: Event }) {
  const availableTickets = event.tickets.filter((ticket) => ticket.available > 0);
  const lowest = availableTickets.length > 0
    ? Math.min(...availableTickets.map((ticket) => ticket.price))
    : null;

  return (
    <Link href={`/eventos/${event.slug}`} className="event-card">
      <div className={`event-art art-${event.artwork}`} aria-hidden="true">
        <span className="art-form art-form-one" />
        <span className="art-form art-form-two" />
        <span className="art-stamp">VT / EVENTOS</span>
      </div>
      <div className="event-card-body">
        <span className="event-category">{event.category}</span>
        <h3>{event.title}</h3>
        <div className="event-card-meta">
          <span><CalendarDays size={16} aria-hidden="true" />{formatDate(event.date)} · {event.time} h</span>
          <span><MapPin size={16} aria-hidden="true" />{event.venue}, {event.city}</span>
        </div>
        <div className="event-card-bottom">
          <span className="event-price">
            {lowest === null ? <strong>Agotado</strong> : <><small>Precio total desde</small><strong>{formatMoney(lowest)} <span>MXN</span></strong></>}
          </span>
          <span className="event-card-action">Ver evento <ArrowUpRight size={18} aria-hidden="true" /></span>
        </div>
      </div>
    </Link>
  );
}
