"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminFetch, AdminApiError, type AdminEvent } from "@/lib/admin";
import { localDateWithOffset } from "@/lib/event-local-date";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const value = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const optional = (form: FormData, key: string) => value(form, key) || null;
const resultPath = (id?: string) => id ? `/admin/eventos/${id}` : "/admin";
// El slug es la parte legible de la URL. La forma elimina acentos y separa palabras con guiones.
function slug(input: string, fallback: string, max: number) {
  const normalized = (input || fallback).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (normalized.length < 2 || normalized.length > max) {
    throw new Error(`La dirección corta debe tener entre 2 y ${max} letras o números. Puedes dejarla vacía para generarla desde el nombre.`);
  }
  return normalized;
}
function id(value: string) { if (!uuid.test(value)) throw new Error("Identificador no válido"); return value; }
function notice(path: string, kind: "ok" | "error", message: string): never {
  redirect(`${path}?${kind}=${encodeURIComponent(message)}`);
}
async function run(path: string, success: string, operation: () => Promise<void>): Promise<never> {
  try { await operation(); revalidatePath("/admin"); revalidatePath(path); }
  catch (error) { notice(path, "error", error instanceof Error ? error.message : "No se pudo guardar el cambio"); }
  notice(path, "ok", success);
}

export type CreateEventResult = { ok: false; message: string; fields: Record<string, string> } | { ok: true; id: string };
export async function createEvent(form: FormData): Promise<CreateEventResult> {
  const fields: Record<string, string> = {};
  const title = value(form, "title");
  const timezone = value(form, "timezone");
  if (!title) fields.title = "Escribe el título del evento.";
  else if (title.length > 160) fields.title = "Usa 160 caracteres o menos.";
  if (!uuid.test(value(form, "categoryId"))) fields.categoryId = "Selecciona una categoría.";
  if (!uuid.test(value(form, "venueId"))) fields.venueId = "Selecciona un recinto.";
  let eventSlug = "";
  try { eventSlug = slug(value(form, "slug"), title, 160); }
  catch (error) { fields.slug = error instanceof Error ? error.message : "Dirección corta no válida."; }
  try { new Intl.DateTimeFormat("en", { timeZone: timezone }); }
  catch { fields.timezone = "Selecciona una zona horaria válida."; }
  const dates: Record<string, string | null> = {};
  for (const name of ["startsAt", "endsAt", "salesStartsAt", "salesEndsAt"]) {
    const raw = value(form, name);
    dates[name] = raw ? localDateWithOffset(raw, timezone) : null;
    if (!raw && (name === "startsAt" || name === "endsAt")) fields[name] = "Selecciona la fecha y hora.";
    else if (raw && !dates[name]) fields[name] = "Selecciona otra hora válida para la zona horaria del recinto.";
  }
  const starts = dates.startsAt ? Date.parse(dates.startsAt) : NaN;
  const ends = dates.endsAt ? Date.parse(dates.endsAt) : NaN;
  if (!fields.endsAt && ends <= starts) fields.endsAt = "El evento debe terminar después de comenzar.";
  if (dates.salesStartsAt && Date.parse(dates.salesStartsAt) >= starts) fields.salesStartsAt = "La venta debe iniciar antes del evento.";
  if (dates.salesEndsAt && Date.parse(dates.salesEndsAt) > starts) fields.salesEndsAt = "La venta debe terminar antes de que comience el evento.";
  if (dates.salesStartsAt && dates.salesEndsAt && Date.parse(dates.salesEndsAt) <= Date.parse(dates.salesStartsAt))
    fields.salesEndsAt = "El fin de venta debe ser posterior a su inicio.";
  const capacityRaw = value(form, "capacityLimit");
  const capacity = Number(capacityRaw);
  if (!capacityRaw || !Number.isInteger(capacity) || capacity < 1 || capacity > 2_147_483_647) fields.capacityLimit = "Escribe una capacidad entera mayor que cero.";
  if (value(form, "summary").length > 500) fields.summary = "Usa 500 caracteres o menos.";
  if (value(form, "description").length > 20_000) fields.description = "Usa 20 000 caracteres o menos.";
  if (Object.keys(fields).length) return { ok: false, message: "Revisa los campos marcados.", fields };
  try {
    const created = await adminFetch<AdminEvent>("/admin/events", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, slug: eventSlug, categoryId: value(form, "categoryId"), venueId: value(form, "venueId"),
        summary: optional(form, "summary"), description: optional(form, "description"),
        startsAt: dates.startsAt, endsAt: dates.endsAt, timezone, capacityLimit: capacity,
        salesStartsAt: dates.salesStartsAt, salesEndsAt: dates.salesEndsAt }) });
    revalidatePath("/admin");
    return { ok: true, id: created.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo crear el evento";
    const apiFields = error instanceof AdminApiError ? error.fields : {};
    if (!Object.keys(apiFields).length) {
      if (message.includes("slug") || message.includes("dirección corta")) apiFields.slug = message.replace("slug", "dirección corta");
      else if (message.includes("capacidad")) apiFields.capacityLimit = message;
      else if (message.includes("categoría")) apiFields.categoryId = message;
      else if (message.includes("recinto")) apiFields.venueId = message;
      else if (message.includes("terminar después")) apiFields.endsAt = message;
      else if (message.includes("venta debe iniciar")) apiFields.salesStartsAt = message;
      else if (message.includes("venta no puede terminar")) apiFields.salesEndsAt = message;
    }
    return { ok: false, message, fields: apiFields };
  }
}
export async function transitionEvent(form: FormData) {
  const eventId = id(value(form, "eventId"));
  const action = value(form, "action");
  if (!["publish", "suspend", "resume"].includes(action)) notice(resultPath(eventId), "error", "Acción no válida");
  return run(resultPath(eventId), "Estado del evento actualizado", async () => {
    await adminFetch(`/admin/events/${eventId}/${action}`, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(action === "suspend" ? { reason: value(form, "reason") } : {}) });
  });
}
export async function changeStaff(form: FormData) {
  const eventId = id(value(form, "eventId")), assignmentId = id(value(form, "assignmentId"));
  return run(resultPath(eventId), "Asignación actualizada", async () => {
    await adminFetch(`/admin/events/${eventId}/staff/${assignmentId}`, { method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: value(form, "status") }) });
  });
}
export async function deleteImage(form: FormData) {
  const eventId = id(value(form, "eventId")), imageId = id(value(form, "imageId"));
  return run(resultPath(eventId), "Imagen eliminada", async () => {
    await adminFetch(`/admin/events/${eventId}/images/${imageId}`, { method: "DELETE" });
  });
}
