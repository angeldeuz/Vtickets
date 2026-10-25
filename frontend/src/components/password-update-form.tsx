"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function PasswordUpdateForm() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password") ?? "");
    const confirm = String(data.get("confirm") ?? "");
    if (password !== confirm) { setMessage("Las contraseñas no coinciden."); setBusy(false); return; }
    const { error } = await createClient().auth.updateUser({ password });
    if (error) setMessage("No pudimos actualizar la contraseña. Vuelve a iniciar sesión e inténtalo de nuevo.");
    else { router.push("/cuenta"); router.refresh(); }
    setBusy(false);
  }

  return <form className="auth-form" onSubmit={submit}>
    <label htmlFor="new-password">Nueva contraseña</label>
    <input id="new-password" name="password" type="password" autoComplete="new-password" minLength={12} required />
    <label htmlFor="confirm-password">Confirma la contraseña</label>
    <input id="confirm-password" name="confirm" type="password" autoComplete="new-password" minLength={12} required />
    {message ? <p className="form-message" role="status">{message}</p> : null}
    <button className="button button-coral auth-submit" type="submit" disabled={busy}>{busy ? "Actualizando…" : "Guardar contraseña"}</button>
  </form>;
}
