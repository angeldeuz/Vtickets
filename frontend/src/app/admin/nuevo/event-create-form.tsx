"use client";

import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createEvent } from "../actions";

type Category = { id: string; name: string };
type Venue = { id: string; name: string; city: string | null; timezone: string };

export function EventCreateForm({ categories, venues }: { categories: Category[]; venues: Venue[] }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [venueId, setVenueId] = useState(venues[0].id);
  const [timezone, setTimezone] = useState(venues[0].timezone);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const clear = (name: string) => {
    if (errors[name]) setErrors((current) => { const next = { ...current }; delete next[name]; return next; });
  };
  const props = (name: string) => ({ name, id: `event-${name}`, "aria-invalid": errors[name] ? true as const : undefined,
    "aria-describedby": errors[name] ? `event-${name}-error` : undefined, onChange: () => clear(name) });
  const field = (name: string, label: string, control: ReactNode) => <label htmlFor={`event-${name}`}>
    {label}{control}{errors[name] && <span id={`event-${name}-error`} className="admin-field-error">{errors[name]}</span>}
  </label>;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setMessage("");
    try {
      const result = await createEvent(new FormData(event.currentTarget));
      if (result.ok) {
        router.push(`/admin/eventos/${result.id}?ok=${encodeURIComponent("Evento creado. Agrega boletos antes de publicarlo")}`);
        router.refresh();
        return;
      }
      setErrors(result.fields);
      setMessage(result.message);
      const first = Object.keys(result.fields)[0];
      if (first) requestAnimationFrame(() => (formRef.current?.elements.namedItem(first) as HTMLElement | null)?.focus());
    } catch {
      setMessage("No se pudo guardar el evento. Inténtalo de nuevo; tus datos siguen aquí.");
    } finally { setSaving(false); }
  }

  return <form ref={formRef} onSubmit={submit} noValidate className="admin-form admin-panel admin-wide-form">
    {message && <p className="admin-feedback admin-feedback-error" role="alert">{message}</p>}
    <div className="admin-form-grid">
      {field("title", "Título", <input {...props("title")} maxLength={160} autoComplete="off" />)}
      {field("slug", "Dirección corta (opcional)", <input {...props("slug")} maxLength={160} placeholder="Ejemplo: festival-de-otono" />)}
      {field("categoryId", "Categoría", <select {...props("categoryId")} defaultValue={categories[0].id}>
        {categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>)}
      {field("venueId", "Recinto", <select {...props("venueId")} value={venueId} onChange={(event) => {
        setVenueId(event.target.value); setTimezone(venues.find((item) => item.id === event.target.value)?.timezone ?? timezone); clear("venueId"); clear("timezone");
      }}>{venues.map((item) => <option key={item.id} value={item.id}>{item.name}{item.city ? ` · ${item.city}` : ""}</option>)}</select>)}
      {field("startsAt", "Inicio del evento", <input {...props("startsAt")} type="datetime-local" step={60} />)}
      {field("endsAt", "Fin del evento", <input {...props("endsAt")} type="datetime-local" step={60} />)}
      {field("timezone", "Zona horaria del recinto", <select {...props("timezone")} value={timezone} onChange={(event) => { setTimezone(event.target.value); clear("timezone"); }}>
        {[...new Set([timezone, ...venues.map((item) => item.timezone), "America/Mexico_City", "America/Monterrey", "America/Cancun", "America/Tijuana", "America/Hermosillo", "America/Mazatlan"])].map((zone) =>
          <option key={zone} value={zone}>{zone.replace("America/", "")}</option>)}
      </select>)}
      {field("capacityLimit", "Capacidad", <input {...props("capacityLimit")} type="number" min={1} max={2147483647} step={1} inputMode="numeric" placeholder="Ejemplo: 500" />)}
      {field("salesStartsAt", "Venta desde (opcional)", <input {...props("salesStartsAt")} type="datetime-local" step={60} />)}
      {field("salesEndsAt", "Venta hasta (opcional)", <input {...props("salesEndsAt")} type="datetime-local" step={60} />)}
    </div>
    <p className="admin-help">La dirección corta se genera a partir del título si la dejas vacía. Las fechas y horas se interpretan en la zona horaria seleccionada.</p>
    {field("summary", "Resumen", <textarea {...props("summary")} maxLength={500} rows={2} />)}
    {field("description", "Descripción", <textarea {...props("description")} maxLength={20000} rows={5} />)}
    <button className="admin-button" type="submit" disabled={saving}>{saving ? "Guardando…" : "Guardar borrador"}</button>
  </form>;
}
