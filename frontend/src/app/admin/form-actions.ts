"use server";

import { revalidatePath } from "next/cache";
import { adminFetch, AdminApiError, type AdminEvent } from "@/lib/admin";
import { localDateWithOffset } from "@/lib/event-local-date";

export type AdminFormOperation = "createCategory" | "updateCategory" | "createVenue" | "updateVenue" |
  "updateEvent" | "createTicket" | "updateTicket" | "uploadImage" | "assignStaff" | "suspendEvent" |
  "publishEvent" | "resumeEvent" | "changeStaff" | "deleteImage";
type Outcome = { ok: true; message: string; id?: string } | { ok: false; message: string; fields: Record<string, string> };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const get = (form: FormData, name: string) => String(form.get(name) ?? "").trim();
const optional = (form: FormData, name: string) => get(form, name) || null;

function shortAddress(input: string, fallback: string, max: number): string | null {
  const text = (input || fallback).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return text.length >= 2 && text.length <= max ? text : null;
}
function required(form: FormData, name: string, fields: Record<string, string>, label: string, max?: number) {
  const text = get(form, name);
  if (!text) fields[name] = `Escribe ${label}.`;
  else if (max && text.length > max) fields[name] = `Usa ${max} caracteres o menos.`;
  return text;
}
function integer(form: FormData, name: string, fields: Record<string, string>, label: string, min: number, max: number, allowEmpty = false) {
  const raw = get(form, name);
  if (!raw && allowEmpty) return null;
  const value = Number(raw);
  if (!raw || !Number.isSafeInteger(value) || value < min || value > max) fields[name] = `${label}: escribe un número entero entre ${min} y ${max}.`;
  return value;
}
function date(form: FormData, name: string, timezone: string, fields: Record<string, string>, required = false) {
  const raw = get(form, name);
  if (!raw) { if (required) fields[name] = "Selecciona fecha y hora."; return null; }
  const converted = localDateWithOffset(raw, timezone);
  if (!converted) fields[name] = "Selecciona una fecha y hora válidas para la zona horaria del evento.";
  return converted;
}
function checkWindow(start: string | null, end: string | null, endName: string, fields: Record<string, string>) {
  if (start && end && Date.parse(end) <= Date.parse(start)) fields[endName] = "La fecha de fin debe ser posterior al inicio.";
}
function apiFailure(error: unknown, operation: AdminFormOperation): Outcome {
  const message = error instanceof Error ? error.message : "No se pudo guardar el cambio.";
  const fields = error instanceof AdminApiError ? { ...error.fields } : {};
  if (!Object.keys(fields).length) {
    if (/slug|dirección corta/i.test(message)) fields.slug = message.replace(/slug/gi, "dirección corta");
    else if (/nombre/i.test(message)) fields.name = message;
    else if (/stock|boletos.*capacidad/i.test(message)) fields.quantityTotal = message;
    else if (/capacidad/i.test(message)) fields[operation === "updateEvent" ? "capacityLimit" : "capacity"] = message;
    else if (/precio/i.test(message)) fields.priceCents = message;
    else if (/venta.*inicio|venta.*iniciar/i.test(message)) fields.salesStartsAt = message;
    else if (/venta.*fin|venta.*terminar|ventana de venta/i.test(message)) fields.salesEndsAt = message;
    else if (/terminar después|fecha de fin/i.test(message)) fields.endsAt = message;
    else if (/categoría/i.test(message)) fields.categoryId = message;
    else if (/recinto/i.test(message)) fields.venueId = message;
    else if (/usuario/i.test(message)) fields.userId = message;
    else if (/imagen|MiB|PNG|JPEG|WebP/i.test(message)) fields.image = message;
    else if (/texto alternativo/i.test(message)) fields.altText = message;
  }
  return { ok: false, message, fields };
}

export async function saveAdminForm(operation: AdminFormOperation, form: FormData): Promise<Outcome> {
  const fields: Record<string, string> = {};
  const eventId = get(form, "eventId");
  if (["updateEvent", "createTicket", "updateTicket", "uploadImage", "assignStaff", "suspendEvent", "publishEvent", "resumeEvent", "changeStaff", "deleteImage"].includes(operation) && !uuid.test(eventId))
    return { ok: false, message: "Identificador de evento no válido.", fields: {} };
  let path = "/admin/catalogo";
  let success = "Cambios guardados.";
  try {
    switch (operation) {
      case "createCategory": {
        const name = required(form, "name", fields, "el nombre", 120);
        const slug = shortAddress(get(form, "slug"), name, 120);
        if (!slug) fields.slug = "Escribe una dirección corta de 2 a 120 caracteres, o deja el campo vacío y usa un nombre más largo.";
        if (get(form, "description").length > 2000) fields.description = "Usa 2000 caracteres o menos.";
        if (Object.keys(fields).length) break;
        await adminFetch("/admin/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, slug, description: optional(form, "description") }) });
        success = "Categoría creada."; break;
      }
      case "updateCategory": {
        const categoryId = get(form, "categoryId");
        if (!uuid.test(categoryId)) fields.name = "Categoría no válida.";
        const name = required(form, "name", fields, "el nombre", 120);
        if (Object.keys(fields).length) break;
        await adminFetch(`/admin/categories/${categoryId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, isActive: get(form, "isActive") === "true" }) });
        success = "Categoría actualizada."; break;
      }
      case "createVenue":
      case "updateVenue": {
        const name = required(form, "name", fields, "el nombre", 160);
        const city = operation === "createVenue" ? required(form, "city", fields, "la ciudad", 120) : optional(form, "city");
        if (city && city.length > 120) fields.city = "Usa 120 caracteres o menos.";
        const capacity = integer(form, "capacity", fields, "Capacidad", 1, 2_147_483_647, operation === "updateVenue");
        const timezone = get(form, "timezone");
        if (operation === "createVenue") { try { new Intl.DateTimeFormat("en", { timeZone: timezone }); } catch { fields.timezone = "Selecciona una zona horaria válida."; } }
        const venueId = get(form, "venueId");
        if (operation === "updateVenue" && !uuid.test(venueId)) fields.name = "Recinto no válido.";
        if (Object.keys(fields).length) break;
        const body = operation === "createVenue" ? { name, city, countryCode: "MX", timezone, capacity } : { name, city, capacity };
        await adminFetch(operation === "createVenue" ? "/admin/venues" : `/admin/venues/${venueId}`,
          { method: operation === "createVenue" ? "POST" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        success = operation === "createVenue" ? "Recinto creado." : "Recinto actualizado."; break;
      }
      case "updateEvent": {
        path = `/admin/eventos/${eventId}`;
        const title = required(form, "title", fields, "el título", 160);
        const slug = shortAddress(get(form, "slug"), title, 160);
        if (!slug) fields.slug = "La dirección corta debe tener al menos 2 caracteres.";
        const categoryId = get(form, "categoryId"), venueId = get(form, "venueId"), timezone = get(form, "timezone");
        if (!uuid.test(categoryId)) fields.categoryId = "Selecciona una categoría.";
        if (!uuid.test(venueId)) fields.venueId = "Selecciona un recinto.";
        try { new Intl.DateTimeFormat("en", { timeZone: timezone }); } catch { fields.timezone = "Selecciona una zona horaria válida."; }
        const startsAt = date(form, "startsAt", timezone, fields, true), endsAt = date(form, "endsAt", timezone, fields, true);
        const salesStartsAt = date(form, "salesStartsAt", timezone, fields), salesEndsAt = date(form, "salesEndsAt", timezone, fields);
        checkWindow(startsAt, endsAt, "endsAt", fields); checkWindow(salesStartsAt, salesEndsAt, "salesEndsAt", fields);
        if (startsAt && salesStartsAt && Date.parse(salesStartsAt) >= Date.parse(startsAt)) fields.salesStartsAt = "La venta debe iniciar antes del evento.";
        if (startsAt && salesEndsAt && Date.parse(salesEndsAt) > Date.parse(startsAt)) fields.salesEndsAt = "La venta debe terminar antes del evento.";
        const capacityLimit = integer(form, "capacityLimit", fields, "Capacidad", 1, 2_147_483_647);
        if (get(form, "summary").length > 500) fields.summary = "Usa 500 caracteres o menos.";
        if (get(form, "description").length > 20000) fields.description = "Usa 20 000 caracteres o menos.";
        if (Object.keys(fields).length) break;
        await adminFetch(`/admin/events/${eventId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, slug,
          categoryId, venueId, summary: optional(form, "summary"), description: optional(form, "description"),
          startsAt, endsAt, timezone, salesStartsAt, salesEndsAt, capacityLimit, updatedAt: get(form, "updatedAt") }) });
        success = "Evento actualizado."; break;
      }
      case "createTicket":
      case "updateTicket": {
        path = `/admin/eventos/${eventId}`;
        const creating = operation === "createTicket";
        const ticketId = get(form, "ticketId");
        if (!creating && !uuid.test(ticketId)) fields.name = "Tipo de boleto no válido.";
        const quantityTotal = integer(form, "quantityTotal", fields, "Stock", 1, 2_147_483_647);
        const draft = creating || form.has("priceCents");
        const changes: Record<string, unknown> = { quantityTotal };
        if (draft) {
          changes.name = required(form, "name", fields, "el nombre", 120);
          changes.description = optional(form, "description");
          if (get(form, "description").length > 2000) fields.description = "Usa 2000 caracteres o menos.";
          changes.priceCents = integer(form, "priceCents", fields, "Precio", 0, Number.MAX_SAFE_INTEGER);
          changes.maxPerOrder = integer(form, "maxPerOrder", fields, "Máximo por compra", 1, 4);
          changes.maxPerUser = integer(form, "maxPerUser", fields, "Máximo por usuario", 1, 4);
          const timezone = get(form, "eventTimezone");
          changes.salesStartsAt = date(form, "salesStartsAt", timezone, fields);
          changes.salesEndsAt = date(form, "salesEndsAt", timezone, fields);
          checkWindow(changes.salesStartsAt as string | null, changes.salesEndsAt as string | null, "salesEndsAt", fields);
        }
        if (!creating) { changes.status = get(form, "status"); changes.updatedAt = get(form, "updatedAt"); }
        if (Object.keys(fields).length) break;
        await adminFetch(creating ? `/admin/events/${eventId}/ticket-types` : `/admin/ticket-types/${ticketId}`,
          { method: creating ? "POST" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(changes) });
        success = creating ? "Tipo de boleto creado." : "Tipo de boleto actualizado."; break;
      }
      case "uploadImage": {
        path = `/admin/eventos/${eventId}`;
        const image = form.get("image");
        if (!(image instanceof File) || !image.size) fields.image = "Selecciona una imagen.";
        else if (image.size > 5 * 1024 * 1024) fields.image = "La imagen debe medir hasta 5 MiB.";
        else if (!["image/png", "image/jpeg", "image/webp"].includes(image.type)) fields.image = "Usa PNG, JPEG o WebP.";
        const altText = required(form, "altText", fields, "el texto alternativo", 300);
        if (Object.keys(fields).length) break;
        const query = new URLSearchParams({ altText, isCover: get(form, "isCover") === "on" ? "true" : "false" });
        await adminFetch(`/admin/events/${eventId}/images?${query}`, { method: "POST", headers: { "Content-Type": (image as File).type }, body: await (image as File).arrayBuffer() });
        success = "Imagen subida."; break;
      }
      case "assignStaff": {
        path = `/admin/eventos/${eventId}`;
        const userId = get(form, "userId"), timezone = get(form, "eventTimezone");
        if (!uuid.test(userId)) fields.userId = "Selecciona un usuario.";
        const startsAt = date(form, "startsAt", timezone, fields), endsAt = date(form, "endsAt", timezone, fields);
        checkWindow(startsAt, endsAt, "endsAt", fields);
        if (Object.keys(fields).length) break;
        await adminFetch(`/admin/events/${eventId}/staff`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, roleCode: "ACCESO", startsAt, endsAt }) });
        success = "Personal asignado."; break;
      }
      case "suspendEvent": {
        path = `/admin/eventos/${eventId}`;
        const reason = required(form, "reason", fields, "el motivo", 1000);
        if (Object.keys(fields).length) break;
        await adminFetch(`/admin/events/${eventId}/suspend`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) });
        success = "Evento suspendido."; break;
      }
      case "publishEvent":
      case "resumeEvent": {
        path = `/admin/eventos/${eventId}`;
        const action = operation === "publishEvent" ? "publish" : "resume";
        await adminFetch(`/admin/events/${eventId}/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
        success = operation === "publishEvent" ? "Evento publicado." : "Ventas reanudadas."; break;
      }
      case "changeStaff": {
        path = `/admin/eventos/${eventId}`;
        const assignmentId = get(form, "assignmentId"), status = get(form, "status");
        if (!uuid.test(assignmentId) || !["assigned", "withdrawn"].includes(status)) {
          fields.actionButton = "La asignación no es válida. Actualiza la página e inténtalo de nuevo."; break;
        }
        await adminFetch(`/admin/events/${eventId}/staff/${assignmentId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
        success = status === "withdrawn" ? "Personal retirado." : "Personal reactivado."; break;
      }
      case "deleteImage": {
        path = `/admin/eventos/${eventId}`;
        const imageId = get(form, "imageId");
        if (!uuid.test(imageId)) { fields.actionButton = "La imagen no es válida. Actualiza la página e inténtalo de nuevo."; break; }
        await adminFetch(`/admin/events/${eventId}/images/${imageId}`, { method: "DELETE" });
        success = "Imagen eliminada."; break;
      }
      default: return { ok: false, message: "Operación desconocida.", fields: {} };
    }
  } catch (error) {
    const failure = apiFailure(error, operation);
    if (["publishEvent", "resumeEvent", "changeStaff", "deleteImage"].includes(operation))
      return { ok: false, message: failure.message, fields: { actionButton: failure.message } };
    return failure;
  }
  if (Object.keys(fields).length) return { ok: false, message: "Revisa los campos marcados.", fields };
  revalidatePath(path); revalidatePath("/admin");
  return { ok: true, message: success };
}
