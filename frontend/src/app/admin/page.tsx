import Link from "next/link";
import { adminFetch, type AdminEvent, type Page } from "@/lib/admin";

const date = (value: string) => new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Mexico_City" }).format(new Date(value));
const status: Record<string, string> = { draft: "Borrador", published: "Publicado", suspended: "Suspendido", cancelled: "Cancelado", completed: "Finalizado" };

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ cursor?: string; ok?: string; error?: string }> }) {
  const query = await searchParams;
  const path = query.cursor ? `/admin/events?limit=50&cursor=${encodeURIComponent(query.cursor)}` : "/admin/events?limit=50";
  const events = await adminFetch<Page<AdminEvent>>(path);
  return <section className="admin-page">
    <div className="admin-heading"><div><h1>Eventos</h1><p>Crea, completa y publica los eventos de la cartelera.</p></div>
      <Link className="admin-button" href="/admin/nuevo">Crear evento</Link></div>
    {query.ok && <p className="admin-feedback" role="status">{query.ok}</p>}
    {query.error && <p className="admin-feedback admin-feedback-error" role="alert">{query.error}</p>}
    {events.items.length ? <div className="admin-list">{events.items.map((event) => <Link className="admin-row" href={`/admin/eventos/${event.id}`} key={event.id}>
      <span><strong>{event.title}</strong><small>{date(event.startsAt)} · {event.timezone}</small></span>
      <span className={`admin-status admin-status-${event.status}`}>{status[event.status] || event.status}</span>
      <span aria-hidden="true">Abrir →</span>
    </Link>)}</div> : <div className="admin-empty"><h2>Aún no hay eventos</h2><p>Empieza con un borrador y agrégale al menos un tipo de boleto.</p>
      <Link href="/admin/nuevo">Crear el primer evento</Link></div>}
    {events.nextCursor && <Link className="admin-next" href={`/admin?cursor=${events.nextCursor}`}>Ver más eventos</Link>}
  </section>;
}
