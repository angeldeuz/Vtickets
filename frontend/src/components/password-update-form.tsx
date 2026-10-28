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
    setMessage("");
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password") ?? "");
    const confirm = String(data.get("confirm") ?? "");
    if (password !== confirm) { setMessage("Las contraseñas no coinciden."); setBusy(false); return; }
    try {
      const { error } = await createClient().auth.updateUser({ password });
      if (error?.code === "same_password") {
        setMessage("La nueva contraseña debe ser diferente de la que usas actualmente.");
      } else if (error?.code === "weak_password") {
        setMessage("La contraseña no cumple los requisitos de seguridad. Elige una más segura.");
      } else if (error?.code === "session_not_found" || error?.code === "session_expired") {
        setMessage("Tu sesión venció. Solicita un nuevo enlace de recuperación e inténtalo otra vez.");
      } else if (error) {
        setMessage("No pudimos actualizar la contraseña. Inténtalo de nuevo.");
      } else {
        router.push("/cuenta");
        router.refresh();
      }
    } catch {
      setMessage("No pudimos conectar con el servicio de acceso. Inténtalo más tarde.");
    } finally {
      setBusy(false);
    }
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
