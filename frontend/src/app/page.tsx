import Link from "next/link";
import { ArrowRight, ArrowUpRight, CalendarDays, MapPin, Ticket } from "lucide-react";
import { DemoNotice } from "@/components/demo-notice";
import { EventCard } from "@/components/event-card";
import { formatDate, formatMoney, getEvents } from "@/lib/events";

// Página de servidor: la fuente de eventos se consulta antes de enviar HTML.
// La vista previa conserva una señal explícita mientras no exista la API real.
export default async function HomePage() {
  const { events, isDemo, error } = await getEvents();
  const featured = events[0];
  const availableTickets = featured?.tickets.filter((ticket) => ticket.available > 0) ?? [];
  const startingPrice = availableTickets.length > 0
    ? Math.min(...availableTickets.map((ticket) => ticket.price))
    : null;

  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <h1>Tu próximo evento, con todo claro desde el inicio.</h1>
            <p>Descubre qué hay para hacer, revisa fecha, recinto y precio total, y elige el plan que va contigo.</p>
            <div className="hero-actions">
              <Link href="/eventos" className="button button-coral">Explorar eventos <ArrowUpRight size={19} aria-hidden="true" /></Link>
              <Link href="/#como-funciona" className="text-link">Cómo funciona <ArrowRight size={18} aria-hidden="true" /></Link>
            </div>
          </div>

          {featured ? (
            <article className="hero-ticket" aria-label="Evento destacado">
              <div className="ticket-head">
                <span>{isDemo ? "Evento de muestra" : "Evento destacado"}</span>
                <Ticket size={23} aria-hidden="true" />
              </div>
              <div className="ticket-main">
                <span className="ticket-category">{featured.category}</span>
                <h2>{featured.title}</h2>
                <p>{featured.description}</p>
              </div>
              <div className="ticket-facts">
                <div><CalendarDays size={19} aria-hidden="true" /><span><strong>{formatDate(featured.date)}</strong>{featured.time} h</span></div>
                <div><MapPin size={19} aria-hidden="true" /><span><strong>{featured.venue}</strong>{featured.city}</span></div>
              </div>
              <div className="ticket-foot">
                <span>{startingPrice === null ? "Entradas agotadas" : <>Precio total desde <strong>{formatMoney(startingPrice)} MXN</strong></>}</span>
                <Link href={`/eventos/${featured.slug}`}>Ver evento <ArrowUpRight size={18} aria-hidden="true" /></Link>
              </div>
            </article>
          ) : (
            <div className="hero-ticket hero-ticket-empty">
              <Ticket size={38} aria-hidden="true" />
              <h2>La cartelera se está preparando</h2>
              <p>Vuelve pronto para encontrar eventos disponibles.</p>
            </div>
          )}
        </div>
      </section>

      <section className="section events-section" id="eventos">
        <div className="container">
          {isDemo ? <DemoNotice /> : null}
          <div className="section-heading">
            <div>
              <h2>Explora los eventos</h2>
              <p>Fecha, lugar y precio a la vista para elegir con calma.</p>
            </div>
            <Link className="text-link section-link" href="/eventos">Ver todo el catálogo <ArrowUpRight size={18} aria-hidden="true" /></Link>
          </div>
          {error ? (
            <div className="message-state" role="alert"><h3>No pudimos cargar los eventos</h3><p>Actualiza la página para intentarlo de nuevo.</p></div>
          ) : events.length === 0 ? (
            <div className="message-state"><h3>Pronto habrá eventos aquí</h3><p>La cartelera todavía no tiene eventos publicados.</p></div>
          ) : (
            <div className="events-grid">{events.slice(0, 3).map((event) => <EventCard key={event.id} event={event} />)}</div>
          )}
        </div>
      </section>

      <section className="how-section" id="como-funciona">
        <div className="container how-grid">
          <div className="how-intro">
            <h2>Del evento a tu entrada</h2>
            <p>Un recorrido sencillo, con la información necesaria en cada paso.</p>
            <Link href="/eventos" className="text-link">Ver eventos <ArrowUpRight size={18} aria-hidden="true" /></Link>
          </div>
          <ol className="steps-list">
            <li><span>1</span><div><h3>Encuentra tu evento</h3><p>Consulta la fecha, la hora local y el lugar antes de decidir.</p></div></li>
            <li><span>2</span><div><h3>Revisa tus entradas</h3><p>Compara tipos, disponibilidad y precio total en MXN.</p></div></li>
            <li><span>3</span><div><h3>Recibe tu ticket</h3><p>Cuando las compras estén disponibles, cada entrada tendrá su propio QR tras confirmar el pago.</p></div></li>
          </ol>
        </div>
      </section>
    </>
  );
}
