import type { Metadata } from "next";
import Link from "next/link";
import { Search, SlidersHorizontal } from "lucide-react";
import { EventCard } from "@/components/event-card";
import { DemoNotice } from "@/components/demo-notice";
import { getEvents } from "@/lib/events";

export const metadata: Metadata = { title: "Explorar eventos" };
const categories = ["Todos", "Música", "Arte y cultura", "Gastronomía", "Experiencias"];

export default async function EventsPage({ searchParams }: { searchParams: Promise<{ q?: string; categoria?: string }> }) {
  const params = await searchParams;
  const { events, isDemo, error } = await getEvents();
  const query = (params.q ?? "").trim().toLocaleLowerCase("es-MX");
  const category = categories.includes(params.categoria ?? "") ? params.categoria! : "Todos";
  const filtered = events.filter((event) => (category === "Todos" || event.category === category) && (!query || `${event.title} ${event.venue} ${event.city}`.toLocaleLowerCase("es-MX").includes(query)));
  return <><section className="catalog-hero"><div className="container"><span className="section-kicker">EVENTOS CERCA DE TI</span><h1>Encuentra algo<br /><em>que te mueva.</em></h1><p>Explora la agenda y descubre qué está pasando en tu ciudad.</p></div></section><section className="catalog-content"><div className="container">{isDemo ? <DemoNotice /> : null}<div className="catalog-toolbar"><form className="search-form" action="/eventos"><Search size={20} /><label className="sr-only" htmlFor="event-search">Buscar eventos</label><input id="event-search" name="q" type="search" placeholder="Busca eventos, lugares o ciudades" defaultValue={params.q ?? ""} /><button type="submit">Buscar</button></form><div className="catalog-count"><SlidersHorizontal size={18} /> {filtered.length} {filtered.length === 1 ? "evento" : "eventos"}</div></div><nav className="category-nav" aria-label="Filtrar por categoría">{categories.map((item) => <Link key={item} className={category === item ? "active" : ""} href={`/eventos${item === "Todos" ? "" : `?categoria=${encodeURIComponent(item)}`}`}>{item}</Link>)}</nav>{error ? <div className="message-state" role="alert"><h2>No se pudieron cargar los eventos</h2><p>Intenta actualizar esta página más tarde.</p></div> : filtered.length === 0 ? <div className="message-state"><h2>No encontramos eventos</h2><p>Prueba otra búsqueda o explora todas las categorías.</p><Link href="/eventos" className="button button-dark">Ver todos los eventos</Link></div> : <div className="events-grid catalog-grid">{filtered.map((event) => <EventCard key={event.id} event={event} />)}</div>}</div></section></>;
}
