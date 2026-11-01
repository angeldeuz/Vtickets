import Link from "next/link";
import { adminFetch, type Page } from "@/lib/admin";
import { EventCreateForm } from "./event-create-form";

type Category = { id: string; name: string; isActive: boolean };
type Venue = { id: string; name: string; city: string | null; timezone: string };

export default async function NewEventPage() {
  const [categories, venues] = await Promise.all([
    adminFetch<Page<Category>>("/admin/categories?limit=100"),
    adminFetch<Page<Venue>>("/admin/venues?limit=100"),
  ]);
  return <section className="admin-page">
    <Link className="admin-back" href="/admin">← Eventos</Link>
    <div className="admin-heading"><div><h1>Nuevo evento</h1><p>Guarda el borrador; después agrega boletos e imágenes.</p></div></div>
    {!categories.items.some((item) => item.isActive) || !venues.items.length ? <div className="admin-empty">
      <h2>Faltan datos del catálogo</h2><p>Crea una categoría activa y un recinto antes de continuar.</p>
      <Link href="/admin/catalogo">Ir al catálogo base</Link></div> :
      <EventCreateForm categories={categories.items.filter((item) => item.isActive)} venues={venues.items} />}
  </section>;
}
