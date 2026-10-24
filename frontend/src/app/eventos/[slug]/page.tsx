import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CalendarDays, Clock3, MapPin, Ticket } from "lucide-react";
import { notFound } from "next/navigation";
import { DemoNotice } from "@/components/demo-notice";
import { formatDate, formatMoney, getEvent } from "@/lib/events";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const { event } = await getEvent(slug);
  return { title: event?.title ?? "Evento" };
}

export default async function EventDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { event, isDemo, error } = await getEvent(slug);
  if (error) return <div className="container message-state detail-error" role="alert"><h1>No se pudo cargar el evento</h1><p>Intenta de nuevo más tarde.</p><Link href="/eventos">Volver al catálogo</Link></div>;
  if (!event) notFound();
  return <><section className="detail-hero"><div className="container"><Link href="/eventos" className="back-link"><ArrowLeft size={17} /> Todos los eventos</Link>{isDemo ? <DemoNotice /> : null}<div className="detail-hero-grid"><div className="detail-intro"><span className="section-kicker">{event.category.toUpperCase()}</span><h1>{event.title}</h1><p>{event.description}</p><div className="detail-pills"><span><CalendarDays size={17} /> {formatDate(event.date)}</span><span><Clock3 size={17} /> {event.time} h</span><span><MapPin size={17} /> {event.city}</span></div></div><div className={`detail-art art-${event.artwork}`} aria-hidden="true"><span className="detail-art-ring" /><strong>{event.title}</strong><span className="art-signal">VT / LIVE</span></div></div></div></section><section className="detail-content"><div className="container detail-grid"><div className="detail-main"><span className="section-kicker dark-kicker">SOBRE EL EVENTO</span><h2>Un plan para <em>recordar.</em></h2><p>{event.description}</p><div className="detail-info-grid"><div><CalendarDays size={25} /><h3>Fecha y hora</h3><p>{formatDate(event.date)} de {event.date.slice(0, 4)}<br />{event.time} h</p></div><div><MapPin size={25} /><h3>Lugar</h3><p>{event.venue}<br />{event.city}</p></div></div></div><aside className="tickets-panel" aria-labelledby="tickets-heading"><span className="section-kicker dark-kicker">TU LUGAR TE ESPERA</span><h2 id="tickets-heading">Entradas</h2>{event.tickets.map((ticket) => <div className="ticket-option" key={ticket.name}><div><strong>{ticket.name}</strong><span>{ticket.available > 0 ? `${ticket.available} lugares disponibles` : "Agotado"}</span></div><strong>{formatMoney(ticket.price)}</strong></div>)}<div className="panel-note"><Ticket size={18} /><span>La venta de boletos estará disponible cuando se integren las reservas y los pagos.</span></div><button className="button button-dark panel-button" type="button" disabled>Compra próximamente</button></aside></div></section></>;
}
