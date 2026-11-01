"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { saveProfileName } from "@/app/cuenta/actions";

export function ProfileNameForm({ name }: { name: string | null }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    const fullName = String(data.get("fullName") ?? "").trim();
    if (!fullName || fullName.length > 120) {
      setError("Escribe un nombre de 1 a 120 caracteres.");
      setMessage("Revisa el nombre.");
      requestAnimationFrame(() => document.getElementById("profile-full-name")?.focus());
      return;
    }
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await saveProfileName(data);
      setMessage(result.message);
      if (!result.ok) setError(result.message);
      else router.refresh();
    } catch { setMessage("No se pudo guardar el nombre. Lo que escribiste sigue aquí."); }
    finally { setBusy(false); }
  }
  return <form className="profile-name-form" onSubmit={submit} noValidate>
    <label htmlFor="profile-full-name">Nombre visible para el equipo</label>
    <div className="profile-name-row"><input id="profile-full-name" name="fullName" defaultValue={name ?? ""} maxLength={120}
      aria-invalid={Boolean(error)} aria-describedby={error ? "profile-name-error" : "profile-name-help"} onChange={() => setError("")} />
      <button className="admin-button" disabled={busy}>{busy ? "Guardando…" : "Guardar nombre"}</button></div>
    {error ? <span id="profile-name-error" className="admin-field-error">{error}</span> :
      <small id="profile-name-help">Este nombre aparece al asignarte a un evento y en la auditoría.</small>}
    {message && <p className="form-message" role="status">{message}</p>}
  </form>;
}
