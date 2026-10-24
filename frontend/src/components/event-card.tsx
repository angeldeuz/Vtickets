import Link from "next/link";
import { ArrowUpRight, MapPin } from "lucide-react";
import { Event, formatDate, formatMoney } from "@/lib/events";

export function EventCard({ event, featured = false }: { event: Event; featured?: boolean }) {
  const lowest = event.tickets.length > 0 ? Math.min(...event.tickets.map((ticket) => ticket.price)) : null;
  return <Link href={`/eventos/${event.slug}`} className={`event-card ${featured ? "event-card-featured" : ""}`}>
    <div className={`event-art art-${event.artwork}`} aria-hidden="true"><span className="art-orb art-orb-one" /><span className="art-orb art-orb-two" /><span className="art-line" /><span className="art-title">{event.title}</span><span className="art-signal">VT / LIVE</span></div>
    <div className="event-card-body"><div className="event-card-top"><span className="eyebrow">{event.category}</span><span className="event-arrow"><ArrowUpRight size={19} /></span></div><h3>{event.title}</h3><p className="event-meta">{formatDate(event.date)} · {event.time} h</p><p className="event-location"><MapPin size={15} /> {event.venue}, {event.city}</p><div className="event-card-bottom"><span>{lowest === null ? "Sin entradas disponibles" : <>Desde <strong>{formatMoney(lowest)}</strong></>}</span><span>Ver evento <ArrowUpRight size={15} /></span></div></div>
  </Link>;
}
