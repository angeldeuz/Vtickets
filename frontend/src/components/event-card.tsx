import Link from "next/link";
import { ArrowUpRight, CalendarDays, MapPin } from "lucide-react";
import type { Event } from "@/lib/events";
import { availablePrice, eventAvailability, formatDate, formatMoney, formatTime } from "@/lib/events";

export function EventCard({ event }: { event: Event }) {
  const lowest = availablePrice(event);

  return (
    <Link href={`/eventos/${event.slug}`} className="event-card">
      <div className="event-art art-coral">
        {event.cover ? <img className="event-cover" src={`/eventos/${event.slug}/imagen`} alt={event.cover.alt} /> : <span className="event-art-title" aria-hidden="true">{event.title}</span>}
      </div>
      <div className="event-card-body">
        <h3>{event.title}</h3>
        <span className="event-category">{event.category}</span>
        <div className="event-card-meta">
          <span><CalendarDays size={16} aria-hidden="true" />{formatDate(event)} · {formatTime(event)} h</span>
          <span><MapPin size={16} aria-hidden="true" />{event.venue}{event.city ? `, ${event.city}` : ""}</span>
        </div>
        <div className="event-card-bottom">
          <span className="event-price">
            {lowest === null ? <strong>{eventAvailability(event)}</strong> : <><small>Precio total desde</small><strong>{formatMoney(lowest)} <span>MXN</span></strong></>}
          </span>
          <span className="event-card-action">Ver evento <ArrowUpRight size={18} aria-hidden="true" /></span>
        </div>
      </div>
    </Link>
  );
}
