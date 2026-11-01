export type AuditRow = { id: string; actorUserId: string | null; action: string; entityName: string; entityId: string | null;
  metadata: Record<string, unknown>; createdAt: string; refActorUserId: { fullName: string | null } | null;
  subjectName: string | null; eventTitle: string | null; ticketName: string | null };

const actionLabels: Record<string, string> = {
  "category.created": "Se creó una categoría", "category.updated": "Se actualizó una categoría",
  "venue.created": "Se creó un recinto", "venue.updated": "Se actualizó un recinto",
  "event.created": "Se creó un evento", "event.updated": "Se editó un evento",
  "event.published": "Se publicó un evento", "event.suspended": "Se suspendió un evento",
  "event.resume": "Se reanudó un evento", "event.resumed": "Se reanudó un evento",
  "ticket_type.created": "Se creó un tipo de boleto", "ticket_type.updated": "Se editó un tipo de boleto",
  "event_image.uploaded": "Se añadió una imagen", "event_image.deleted": "Se eliminó una imagen",
  "staff.assigned": "Se asignó personal de acceso", "staff.withdrawn": "Se retiró personal de acceso",
  "staff.updated": "Se actualizó una asignación de acceso",
};
const entityLabels: Record<string, string> = { categoria: "Categoría", ubicacion: "Recinto", evento: "Evento",
  tipo_ticket: "Tipo de boleto", evento_imagen: "Imagen del evento", personal_evento: "Personal de acceso" };
const fieldLabels: Record<string, string> = { title: "Título", name: "Nombre", city: "Ciudad", isActive: "Estado",
  capacity: "Capacidad", capacityLimit: "Capacidad", quantityTotal: "Stock", priceCents: "Precio",
  status: "Estado", startsAt: "Inicio", endsAt: "Fin", salesStartsAt: "Venta desde", salesEndsAt: "Venta hasta",
  maxPerOrder: "Máximo por compra", maxPerUser: "Máximo por usuario", timezone: "Zona horaria",
  summary: "Resumen", description: "Descripción", categoryId: "Categoría", venueId: "Recinto" };
const statuses: Record<string, string> = { draft: "Borrador", published: "Publicado", suspended: "Suspendido",
  active: "Activo", paused: "Pausado", assigned: "Asignado", withdrawn: "Retirado" };
const value = (record: Record<string, unknown>, key: string) => record[key];
const object = (input: unknown): Record<string, unknown> => input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : {};
const money = (cents: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(cents / 100);
function readable(key: string, input: unknown): string {
  if (input === null || input === undefined || input === "") return "Sin definir";
  if (typeof input === "boolean") return input ? "Activo" : "Inactivo";
  if (key === "priceCents" && typeof input === "number") return money(input);
  if (key.toLowerCase().endsWith("at") && typeof input === "string") {
    const parsed = new Date(input);
    if (!Number.isNaN(parsed.getTime())) return parsed.toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });
  }
  if (key.endsWith("Id")) return "Referencia modificada";
  if (typeof input === "string") return statuses[input] ?? input;
  if (typeof input === "number") return new Intl.NumberFormat("es-MX").format(input);
  return "Dato actualizado";
}

export function describeAudit(row: AuditRow) {
  const metadata = object(row.metadata);
  const before = object(metadata.before), after = object(metadata.after);
  const title = row.action === "event.published" && metadata.from === "suspended" ? "Se reanudó un evento" :
    actionLabels[row.action] ?? `${entityLabels[row.entityName] ?? "Registro"}: cambio registrado`;
  const subject = row.subjectName ?? (row.entityName === "personal_evento" ? "Cuenta sin nombre" : null);
  const label = row.entityName === "personal_evento" ? subject : row.entityName === "tipo_ticket" ? row.ticketName ?? (typeof metadata.name === "string" ? metadata.name : "Tipo de boleto") :
    row.entityName === "evento" || row.entityName === "evento_imagen" ? row.eventTitle ?? (typeof metadata.title === "string" ? metadata.title : "Evento") :
    typeof after.name === "string" ? after.name : typeof before.name === "string" ? before.name : entityLabels[row.entityName] ?? "Registro";
  const facts: Array<{ label: string; text: string }> = [];
  const add = (label: string, text: string) => { if (text) facts.push({ label, text }); };
  if (row.eventTitle && row.entityName !== "evento" && row.entityName !== "evento_imagen") add("Evento", row.eventTitle);
  if (Array.isArray(metadata.changedFields)) {
    for (const key of metadata.changedFields) {
      if (typeof key !== "string" || !fieldLabels[key] || key.endsWith("Id")) continue;
      const oldValue = value(before, key), newValue = value(after, key);
      if (newValue === undefined) continue;
      const oldText = oldValue === undefined ? "" : `${readable(key, oldValue)} → `;
      add(fieldLabels[key], `${oldText}${readable(key, newValue)}`);
    }
  }
  if (row.action.endsWith(".created")) {
    for (const key of ["priceCents", "quantityTotal", "capacity", "capacityLimit", "city"]) {
      const raw = metadata[key] ?? after[key];
      if (raw !== undefined) add(fieldLabels[key], readable(key, raw));
    }
  }
  if (typeof metadata.from === "string" && typeof metadata.to === "string") add("Estado", `${readable("status", metadata.from)} → ${readable("status", metadata.to)}`);
  if (typeof metadata.reason === "string") add("Motivo", metadata.reason);
  if (typeof metadata.isCover === "boolean") add("Imagen", metadata.isCover ? "Portada del evento" : "Imagen adicional");
  if (row.entityName === "personal_evento" && metadata.startsAt) add("Vigente desde", readable("startsAt", metadata.startsAt));
  if (row.entityName === "personal_evento" && metadata.endsAt) add("Vigente hasta", readable("endsAt", metadata.endsAt));
  return { title, label, facts };
}
