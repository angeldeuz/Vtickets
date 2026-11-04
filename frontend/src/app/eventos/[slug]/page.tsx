import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CalendarDays, Clock3, MapPin, Ticket } from "lucide-react";
import { notFound } from "next/navigation";
import { formatDate, formatTime, getEvent } from "@/lib/events";
import { TicketSelection } from "./ticket-selection";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const { event } = await getEvent(slug);
  return { title: event?.title ?? "Evento" };
}

export default async function EventDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { event, error } = await getEvent(slug);
  if (error) {
    return <div className="container message-state detail-error" role="alert"><h1>No se pudo cargar el evento</h1><p>Actualiza la página para intentarlo de nuevo.</p><Link href="/eventos">Volver al catálogo</Link></div>;
  }
  if (!event) notFound();

  return (
    <>
      <section className="detail-hero">
        <div className="container">
          <Link href="/eventos" className="back-link"><ArrowLeft size={18} aria-hidden="true" /> Todos los eventos</Link>
          {event.cover ? <img className="detail-cover" src={`/eventos/${event.slug}/imagen`} alt={event.cover.alt} /> : null}
          <div className="detail-hero-grid">
            <div className="detail-intro">
              <h1>{event.title}</h1>
              <p className="detail-category">{event.category}</p>
              <p className="detail-description">{event.description || event.summary}</p>
              <dl className="detail-facts">
                <div><dt><CalendarDays size={20} aria-hidden="true" /> Fecha</dt><dd>{formatDate(event)}</dd></div>
                <div><dt><Clock3 size={20} aria-hidden="true" /> Hora</dt><dd>{formatTime(event)} h, hora del evento</dd></div>
                <div><dt><MapPin size={20} aria-hidden="true" /> Lugar</dt><dd>{event.venue}{event.address ? `, ${event.address}` : ""}{event.city ? `, ${event.city}` : ""}{event.region ? `, ${event.region}` : ""}</dd></div>
              </dl>
            </div>
            <aside className="tickets-panel" aria-labelledby="tickets-heading">
              <div className="tickets-panel-head">
                <span className="ticket-panel-icon" aria-hidden="true"><Ticket size={21} /></span>
                <div><h2 id="tickets-heading">Entradas</h2><p>El precio publicado es el total en MXN.</p></div>
              </div>
              {event.tickets.length === 0 ? <p className="tickets-empty">Aún no hay entradas publicadas.</p> : <TicketSelection event={event} />}
            </aside>
          </div>
        </div>
      </section>
      <section className="detail-content">
        <div className="container detail-content-inner">
          <div><h2>Antes de elegir</h2><p>Comprueba la fecha, el recinto y el tipo de entrada. Puedes reservar hasta cuatro entradas por evento.</p></div>
          <Link href="/eventos" className="button button-dark">Explorar otros eventos</Link>
        </div>
      </section>
    </>
  );
}
