import { adminFetchAll } from "@/lib/admin";
import { AdminForm } from "@/components/admin-form";

type Category = { id: string; name: string; slug: string; isActive: boolean };
type Venue = { id: string; name: string; city: string | null; capacity: number | null };

export default async function CatalogAdminPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const query = await searchParams;
  const [categories, venues] = await Promise.all([
    adminFetchAll<Category>("/admin/categories"), adminFetchAll<Venue>("/admin/venues"),
  ]);
  return <section className="admin-page"><div className="admin-heading"><div><h1>Catálogo base</h1>
    <p>Prepara categorías y recintos antes de crear un evento.</p></div></div>
    {query.ok && <p className="admin-feedback" role="status">{query.ok}</p>}
    {query.error && <p className="admin-feedback admin-feedback-error" role="alert">{query.error}</p>}
    <div className="admin-columns"><section className="admin-panel"><h2>Categorías</h2>
      <div className="admin-catalog-list">{categories.map((item) => <AdminForm operation="updateCategory" className="admin-catalog-row" key={item.id}>
        <input type="hidden" name="categoryId" value={item.id} />
        <label>Nombre<input name="name" defaultValue={item.name} required /></label>
        <label>Estado<select name="isActive" defaultValue={String(item.isActive)}><option value="true">Activa</option><option value="false">Inactiva</option></select></label>
        <button className="admin-text-button">Guardar</button></AdminForm>)}</div>
      <AdminForm operation="createCategory" className="admin-form"><h3>Nueva categoría</h3>
        <label>Nombre<input name="name" required maxLength={120} /></label>
        <label>Dirección corta (opcional)<input name="slug" maxLength={120} placeholder="Ejemplo: musica-en-vivo" aria-describedby="category-slug-help" /></label>
        <p id="category-slug-help" className="admin-help">Es la parte de la URL que identifica la categoría. Si la dejas vacía, se crea desde el nombre. Puedes escribir palabras normales: se convertirán a minúsculas, sin acentos y separadas por guiones.</p>
        <label>Descripción<textarea name="description" rows={2} /></label>
        <button className="admin-button">Guardar categoría</button>
      </AdminForm></section>
      <section className="admin-panel"><h2>Recintos</h2>
        <div className="admin-catalog-list">{venues.map((item) => <AdminForm operation="updateVenue" className="admin-catalog-row" key={item.id}>
          <input type="hidden" name="venueId" value={item.id} /><label>Nombre<input name="name" defaultValue={item.name} required /></label>
          <label>Ciudad<input name="city" defaultValue={item.city ?? ""} /></label>
          <label>Capacidad<input name="capacity" type="number" min={1} defaultValue={item.capacity ?? ""} /></label>
          <button className="admin-text-button">Guardar</button></AdminForm>)}</div>
        <AdminForm operation="createVenue" className="admin-form"><h3>Nuevo recinto</h3>
          <label>Nombre<input name="name" required /></label><label>Ciudad<input name="city" required /></label>
          <label>Zona horaria<select name="timezone" defaultValue="America/Monterrey"><option value="America/Monterrey">Monterrey / Saltillo</option><option value="America/Mexico_City">Ciudad de México</option><option value="America/Cancun">Cancún</option><option value="America/Tijuana">Tijuana</option><option value="America/Hermosillo">Hermosillo</option><option value="America/Mazatlan">Mazatlán</option></select></label>
          <label>Capacidad<input name="capacity" type="number" min={1} required /></label>
          <button className="admin-button">Guardar recinto</button>
        </AdminForm></section></div>
  </section>;
}
