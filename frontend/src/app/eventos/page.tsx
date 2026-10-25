import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { EventCard } from "@/components/event-card";
import { DemoNotice } from "@/components/demo-notice";
import { getEvents } from "@/lib/events";

export const metadata: Metadata = { title: "Explorar eventos" };
const categories = ["Todos", "Música", "Arte y cultura", "Gastronomía", "Experiencias"];

export default async function EventsPage({ searchParams }: { searchParams: Promise<{ q?: string; categoria?: string }> }) {
  const params = await searchParams;
  const { events, isDemo, error } = await getEvents();
  const query = (params.q ?? "").trim();
  const category = categories.includes(params.categoria ?? "") ? params.categoria! : "Todos";
  const search = query.toLocaleLowerCase("es-MX");
  const filtered = events.filter((event) =>
    (category === "Todos" || event.category === category) &&
    (!search || `${event.title} ${event.venue} ${event.city}`.toLocaleLowerCase("es-MX").includes(search))
  );

  function categoryHref(item: string) {
    const next = new URLSearchParams();
    if (query) next.set("q", query);
    if (item !== "Todos") next.set("categoria", item);
    const suffix = next.toString();
    return suffix ? `/eventos?${suffix}` : "/eventos";
  }

  return (
    <>
      <section className="catalog-hero">
        <div className="container catalog-hero-inner">
          <h1>Encuentra tu próximo evento</h1>
          <p>Explora la cartelera y comprueba fecha, lugar y precio antes de elegir.</p>
        </div>
      </section>
      <section className="catalog-content">
        <div className="container">
          {isDemo ? <DemoNotice /> : null}
          <form className="search-form" action="/eventos" role="search">
            <Search size={20} aria-hidden="true" />
            <label className="sr-only" htmlFor="event-search">Buscar eventos, lugares o ciudades</label>
            <input id="event-search" name="q" type="search" placeholder="Busca un evento o lugar…" defaultValue={query} autoComplete="off" />
            {category !== "Todos" ? <input type="hidden" name="categoria" value={category} /> : null}
            <button type="submit">Buscar</button>
          </form>
          <nav className="category-nav" aria-label="Filtrar por categoría">
            {categories.map((item) => (
              <Link key={item} className={category === item ? "active" : ""} aria-current={category === item ? "page" : undefined} href={categoryHref(item)}>{item}</Link>
            ))}
          </nav>
          <div className="catalog-summary">
            <h2>{category === "Todos" ? "Todos los eventos" : category}</h2>
            {!error ? <p>{filtered.length} {filtered.length === 1 ? "evento" : "eventos"}</p> : null}
          </div>
          {error ? (
            <div className="message-state" role="alert"><h3>No se pudieron cargar los eventos</h3><p>Actualiza la página para intentarlo de nuevo.</p></div>
          ) : filtered.length === 0 ? (
            <div className="message-state"><h3>No encontramos eventos</h3><p>Prueba otra búsqueda o consulta todas las categorías.</p><Link href="/eventos" className="button button-dark">Ver todos los eventos</Link></div>
          ) : (
            <div className="events-grid catalog-grid">{filtered.map((event) => <EventCard key={event.id} event={event} />)}</div>
          )}
        </div>
      </section>
    </>
  );
}
