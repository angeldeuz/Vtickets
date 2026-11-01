import Link from "next/link";
import { adminFetch, adminFetchAll, type AdminEvent, type AdminImage, type AdminStaff, type AdminTicket } from "@/lib/admin";
import { AdminForm } from "@/components/admin-form";
import { dateInputValue } from "@/lib/event-local-date";
import { StaffUserPicker } from "@/components/staff-user-picker";

const money = (cents: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(cents / 100);
const statusLabel: Record<string, string> = { draft: "Borrador", published: "Publicado", suspended: "Suspendido", cancelled: "Cancelado", completed: "Finalizado" };

export default async function EventAdminPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const [event, tickets, staff, images, users, categories, venues] = await Promise.all([
    adminFetch<AdminEvent>(`/admin/events/${encodeURIComponent(id)}`),
    adminFetch<AdminTicket[]>(`/admin/events/${encodeURIComponent(id)}/ticket-types`),
    adminFetch<AdminStaff[]>(`/admin/events/${encodeURIComponent(id)}/staff`),
    adminFetch<AdminImage[]>(`/admin/events/${encodeURIComponent(id)}/images`),
    adminFetch<Array<{ id: string; fullName: string | null; phone: string | null }>>("/admin/users"),
    adminFetchAll<{ id: string; name: string; isActive: boolean }>("/admin/categories"),
    adminFetchAll<{ id: string; name: string }>("/admin/venues"),
  ]);
  const draft = event.status === "draft";
  const active = ["published", "suspended"].includes(event.status);
  return <section className="admin-page"><Link className="admin-back" href="/admin">← Eventos</Link>
    <div className="admin-heading"><div><h1>{event.title}</h1><p>{venues.find((item) => item.id === event.venueId)?.name ?? "Recinto por confirmar"} · {new Date(event.startsAt).toLocaleString("es-MX", { timeZone: event.timezone, dateStyle: "medium", timeStyle: "short" })}</p></div>
      <span className={`admin-status admin-status-${event.status}`}>{statusLabel[event.status] ?? "Evento"}</span></div>
    {query.ok && <p className="admin-feedback" role="status">{query.ok}</p>}
    {query.error && <p className="admin-feedback admin-feedback-error" role="alert">{query.error}</p>}
    <div className="admin-summary"><span>Inicio <strong>{new Date(event.startsAt).toLocaleString("es-MX", { timeZone: event.timezone })}</strong></span>
      <span>Capacidad <strong>{event.capacityLimit}</strong></span><span>Tipos <strong>{tickets.length}</strong></span></div>

    <div className="admin-columns"><section className="admin-panel"><h2>Estado del evento</h2>
      {draft && <><p>Agrega al menos un tipo activo antes de publicar.</p><AdminForm operation="publishEvent" className="admin-action-form">
        <input type="hidden" name="eventId" value={id} />
        <button className="admin-button" name="actionButton">Publicar evento</button></AdminForm></>}
      {event.status === "published" && <AdminForm operation="suspendEvent" className="admin-form">
        <input type="hidden" name="eventId" value={id} /><input type="hidden" name="action" value="suspend" />
        <label>Motivo de suspensión<textarea name="reason" required rows={2} /></label>
        <button className="admin-button admin-button-secondary">Suspender evento</button></AdminForm>}
      {event.status === "suspended" && <AdminForm operation="resumeEvent" className="admin-action-form">
        <input type="hidden" name="eventId" value={id} />
        <button className="admin-button" name="actionButton">Reanudar ventas</button></AdminForm>}
      {!draft && !active && <p>Este evento ya no admite cambios administrativos en la fase actual.</p>}
    </section>
    {draft && <section className="admin-panel"><h2>Datos del borrador</h2><AdminForm operation="updateEvent" className="admin-form">
      <input type="hidden" name="eventId" value={id} /><input type="hidden" name="updatedAt" value={event.updatedAt} />
      <label>Título<input name="title" defaultValue={event.title} required /></label>
      <label>Dirección corta<input name="slug" defaultValue={event.slug} aria-describedby="edit-event-slug-help" /></label>
      <p id="edit-event-slug-help" className="admin-help">Identifica el evento en la URL. Puedes escribir palabras normales; se guardarán en minúsculas y con guiones.</p>
      <label>Categoría<select name="categoryId" defaultValue={event.categoryId}>{categories.filter((item) => item.isActive || item.id === event.categoryId)
        .map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Recinto<select name="venueId" defaultValue={event.venueId}>{venues.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Resumen<textarea name="summary" defaultValue={event.summary ?? ""} rows={2} /></label>
      <label>Descripción<textarea name="description" defaultValue={event.description ?? ""} rows={3} /></label>
      <label>Inicio del evento<input name="startsAt" type="datetime-local" defaultValue={dateInputValue(event.startsAt, event.timezone)} /></label>
      <label>Fin del evento<input name="endsAt" type="datetime-local" defaultValue={dateInputValue(event.endsAt, event.timezone)} /></label>
      <label>Zona horaria<select name="timezone" defaultValue={event.timezone}>{[...new Set([event.timezone, "America/Monterrey", "America/Mexico_City", "America/Cancun", "America/Tijuana", "America/Hermosillo", "America/Mazatlan"])].map((zone) => <option key={zone} value={zone}>{zone.replace("America/", "")}</option>)}</select></label>
      <label>Venta desde (opcional)<input name="salesStartsAt" type="datetime-local" defaultValue={dateInputValue(event.salesStartsAt, event.timezone)} /></label>
      <label>Venta hasta (opcional)<input name="salesEndsAt" type="datetime-local" defaultValue={dateInputValue(event.salesEndsAt, event.timezone)} /></label>
      <label>Capacidad<input name="capacityLimit" type="number" min={1} defaultValue={event.capacityLimit} required /></label>
      <button className="admin-button admin-button-secondary">Guardar cambios</button></AdminForm></section>}
    </div>

    <section className="admin-panel admin-section"><h2>Tipos de boleto</h2>
      {tickets.length ? <div className="admin-ticket-list">{tickets.map((ticket) => <article className="admin-ticket" key={ticket.id}>
        <div className="admin-ticket-summary"><div><strong>{ticket.name}</strong><p>{money(ticket.priceCents)} · {ticket.status === "active" ? "Activo" : "Pausado"}</p></div>
          <div className="admin-ticket-counts"><span>Stock <b>{ticket.quantityTotal}</b></span><span>Reservados <b>{ticket.inventory?.reservedCount ?? 0}</b></span><span>Vendidos <b>{ticket.inventory?.soldCount ?? 0}</b></span></div></div>
        {(draft || active) && <details className="admin-ticket-edit"><summary>Editar boleto</summary><AdminForm operation="updateTicket" className="admin-form admin-ticket-edit-form">
          <input type="hidden" name="eventId" value={id} /><input type="hidden" name="ticketId" value={ticket.id} />
          <input type="hidden" name="updatedAt" value={ticket.updatedAt} />
          <input type="hidden" name="eventTimezone" value={event.timezone} />
          <div className="admin-form-grid"><label>Stock<input name="quantityTotal" type="number" min={1} defaultValue={ticket.quantityTotal} required /></label>
          <label>Estado<select name="status" defaultValue={ticket.status}><option value="active">Activo</option><option value="paused">Pausado</option></select></label>
          {draft && <><label>Nombre<input name="name" defaultValue={ticket.name} required /></label>
            <label>Precio en centavos<input name="priceCents" type="number" min={0} defaultValue={ticket.priceCents} required /></label>
            <label>Máximo por compra<input name="maxPerOrder" type="number" min={1} max={4} defaultValue={ticket.maxPerOrder} required /></label>
            <label>Máximo por usuario<input name="maxPerUser" type="number" min={1} max={4} defaultValue={ticket.maxPerUser} required /></label>
            <label>Venta desde<input name="salesStartsAt" type="datetime-local" defaultValue={dateInputValue(ticket.salesStartsAt, event.timezone)} /></label>
            <label>Venta hasta<input name="salesEndsAt" type="datetime-local" defaultValue={dateInputValue(ticket.salesEndsAt, event.timezone)} /></label>
            <label className="admin-form-full">Descripción<textarea name="description" defaultValue={ticket.description ?? ""} rows={2} /></label></>}</div>
          <button className="admin-button admin-button-secondary">Guardar boleto</button></AdminForm></details>}
      </article>)}</div> : <p>Sin tipos de boleto. El evento no puede publicarse todavía.</p>}
      {draft && <AdminForm operation="createTicket" className="admin-form admin-divider"><h3>Nuevo tipo de boleto</h3>
        <input type="hidden" name="eventId" value={id} />
        <input type="hidden" name="eventTimezone" value={event.timezone} />
        <div className="admin-form-grid"><label>Nombre<input name="name" required /></label>
          <label>Precio total en centavos<input name="priceCents" type="number" min={0} required /></label>
          <label>Stock<input name="quantityTotal" type="number" min={1} required /></label>
          <label>Máximo por compra<input name="maxPerOrder" type="number" min={1} max={4} defaultValue={4} required /></label>
          <label>Máximo por usuario<input name="maxPerUser" type="number" min={1} max={4} defaultValue={4} required /></label>
          <label>Venta desde (opcional)<input name="salesStartsAt" type="datetime-local" /></label>
          <label>Venta hasta (opcional)<input name="salesEndsAt" type="datetime-local" /></label></div>
        <label>Descripción<textarea name="description" rows={2} /></label>
        <button className="admin-button">Agregar tipo</button>
      </AdminForm>}
    </section>

    <div className="admin-columns admin-section"><section className="admin-panel"><h2>Imágenes</h2>
      {images.length ? <ul className="admin-image-list">{images.map((image) => <li className="admin-image-item" key={image.id}>
        <a className="admin-image-preview" href={`/admin/eventos/${id}/imagenes/${image.id}`} target="_blank" rel="noopener noreferrer" aria-label={`Ver imagen completa: ${image.altText || "imagen del evento"}`}>
          {/* La ruta local exige sesión administrativa y entrega bytes del bucket privado. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/admin/eventos/${id}/imagenes/${image.id}`} alt={image.altText || "Imagen del evento"} loading="lazy" />
        </a>
        <span className="admin-image-copy"><strong>{image.isCover ? "Portada" : "Imagen adicional"}</strong><small>{image.altText || "Sin texto alternativo"}</small></span>
        {draft && <AdminForm operation="deleteImage" className="admin-action-form"><input type="hidden" name="eventId" value={id} /><input type="hidden" name="imageId" value={image.id} />
          <button className="admin-text-button" name="actionButton">Eliminar</button></AdminForm>}</li>)}</ul> : <p>Aún no hay imágenes.</p>}
      {draft && <AdminForm operation="uploadImage" className="admin-form admin-divider">
        <input type="hidden" name="eventId" value={id} /><label>Imagen PNG, JPEG o WebP<input name="image" type="file" accept="image/png,image/jpeg,image/webp" required /></label>
        <label>Texto alternativo<input name="altText" required /></label>
        <label className="admin-checkbox"><input name="isCover" type="checkbox" /> Usar como portada</label>
        <button className="admin-button admin-button-secondary">Subir imagen</button></AdminForm>}
    </section>
    <section className="admin-panel"><h2>Personal de acceso</h2>
      {staff.length ? <ul className="admin-plain-list">{staff.map((person) => <li key={person.id}><span>
        {person.refUserId.fullName || "Nombre pendiente de completar"}<small>{person.refUserId.phone ? `${person.refUserId.phone} · ` : ""}{person.status === "assigned" ? "Asignado" : "Retirado"}</small></span>
        <AdminForm operation="changeStaff" className="admin-action-form"><input type="hidden" name="eventId" value={id} /><input type="hidden" name="assignmentId" value={person.id} />
          <input type="hidden" name="status" value={person.status === "assigned" ? "withdrawn" : "assigned"} />
          <button className="admin-text-button" name="actionButton">{person.status === "assigned" ? "Retirar" : "Reactivar"}</button></AdminForm></li>)}</ul> : <p>No hay personal asignado.</p>}
      {(draft || active) && <AdminForm operation="assignStaff" className="admin-form admin-divider"><h3>Asignar acceso</h3>
        <input type="hidden" name="eventId" value={id} /><input type="hidden" name="eventTimezone" value={event.timezone} />
        <StaffUserPicker initialUsers={users} />
        <label>Vigente desde (opcional)<input name="startsAt" type="datetime-local" /></label>
        <label>Vigente hasta (opcional)<input name="endsAt" type="datetime-local" /></label>
        <button className="admin-button admin-button-secondary">Asignar personal</button></AdminForm>}
    </section></div>
  </section>;
}
