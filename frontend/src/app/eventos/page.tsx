import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { EventCard } from "@/components/event-card";
import { getEventCategories, getEvents } from "@/lib/events";

export const metadata: Metadata = { title: "Explorar eventos" };

export default async function EventsPage({ searchParams }: { searchParams: Promise<{ q?: string; categoria?: string; cursor?: string }> }) {
  const params = await searchParams;
  const query = (params.q ?? "").trim();
  const category = (params.categoria ?? "").trim();
  const [result, categoryResult] = await Promise.all([
    getEvents({ q: query || undefined, category: category || undefined, cursor: params.cursor }),
    getEventCategories(),
  ]);
  const { events, nextCursor, error } = result;
  const categories = ["Todos", ...new Set(categoryResult.categories)];

  function categoryHref(item: string) {
    const next = new URLSearchParams();
    if (query) next.set("q", query);
    if (item !== "Todos") next.set("categoria", item);
    const suffix = next.toString();
    return suffix ? `/eventos?${suffix}` : "/eventos";
  }

  function pageHref(cursor: string) {
    const next = new URLSearchParams();
    if (query) next.set("q", query);
    if (category) next.set("categoria", category);
    next.set("cursor", cursor);
    return `/eventos?${next}`;
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
          <form className="search-form" action="/eventos" role="search">
            <Search size={20} aria-hidden="true" />
            <label className="sr-only" htmlFor="event-search">Buscar eventos, lugares o ciudades</label>
            <input id="event-search" name="q" type="search" maxLength={100} placeholder="Busca un evento o lugar…" defaultValue={query} autoComplete="off" />
            {category ? <input type="hidden" name="categoria" value={category} /> : null}
            <button type="submit">Buscar</button>
          </form>
          <nav className="category-nav" aria-label="Filtrar por categoría">
            {categories.map((item) => (
              <Link key={item} className={(category || "Todos") === item ? "active" : ""} aria-current={(category || "Todos") === item ? "page" : undefined} href={categoryHref(item)}>{item}</Link>
            ))}
          </nav>
          <div className="catalog-summary">
            <h2>{category || "Todos los eventos"}</h2>
            {!error ? <p>{events.length} {events.length === 1 ? "evento" : "eventos"} en esta página</p> : null}
          </div>
          {error ? (
            <div className="message-state" role="alert"><h3>No se pudieron cargar los eventos</h3><p>Actualiza la página para intentarlo de nuevo.</p></div>
          ) : events.length === 0 ? (
            <div className="message-state"><h3>No encontramos eventos</h3><p>Prueba otra búsqueda o consulta todas las categorías.</p><Link href="/eventos" className="button button-dark">Ver todos los eventos</Link></div>
          ) : (
            <div className="events-grid catalog-grid">{events.map((event) => <EventCard key={event.id} event={event} />)}</div>
          )}
          {!error && (params.cursor || nextCursor) ? (
            <nav className="catalog-pagination" aria-label="Páginas del catálogo">
              {params.cursor ? <Link href={categoryHref(category || "Todos")}>Volver al inicio</Link> : null}
              {nextCursor ? <Link href={pageHref(nextCursor)} rel="next">Siguiente página</Link> : null}
            </nav>
          ) : null}
        </div>
      </section>
    </>
  );
}
