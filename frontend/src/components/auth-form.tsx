"use client";

// use client: los formularios llaman Supabase Auth desde el navegador y reaccionan sin recargar la página.

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { supabaseConfig } from "@/lib/supabase/config";

type Mode = "login" | "signup" | "recovery";

export function AuthForm({ mode, afterLogin }: { mode: Mode; afterLogin?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const configured = Boolean(supabaseConfig());

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!configured) return;
    setBusy(true);
    setMessage("");
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    const next: Record<string, string> = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) next.email = "Escribe un correo electrónico válido.";
    if (mode !== "recovery" && !password) next.password = "Escribe tu contraseña.";
    else if (mode === "signup" && password.length < 12) next.password = "Usa al menos 12 caracteres.";
    if (Object.keys(next).length) { setErrors(next); setMessage("Revisa los campos marcados."); requestAnimationFrame(() => document.getElementById(`auth-${Object.keys(next)[0]}`)?.focus()); setBusy(false); return; }
    setErrors({});
    const supabase = createClient();
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) { setErrors({ password: "Revisa el correo y la contraseña." }); setMessage("No pudimos iniciar sesión. Revisa tus datos e inténtalo otra vez."); requestAnimationFrame(() => document.getElementById("auth-password")?.focus()); return; }
        router.push(afterLogin ?? "/cuenta");
        router.refresh();
      } else if (mode === "signup") {
        const { data: result, error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) { setErrors(error.code === "weak_password" ? { password: "Elige una contraseña más segura." } : error.code === "email_address_invalid" ? { email: "Revisa el correo electrónico." } : {}); setMessage("No pudimos crear la cuenta. Revisa los datos o inténtalo más tarde."); return; }
        if (result.session) { router.push("/cuenta"); router.refresh(); }
        else setMessage("Solicitud recibida. Si ya tenías cuenta, entra con tu contraseña anterior o usa «Olvidé mi contraseña». Si es nueva, revisa el correo de confirmación.");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/callback?next=/actualizar-contrasena`,
        });
        if (error) {
          setMessage(error.code === "over_email_send_rate_limit"
            ? "Supabase alcanzó el límite de correos. Vuelve a intentarlo en aproximadamente una hora."
            : "No pudimos enviar las instrucciones en este momento. Inténtalo más tarde.");
          return;
        }
        // La misma respuesta evita revelar si el correo pertenece a una cuenta.
        setMessage("Si existe una cuenta con ese correo, recibirás instrucciones para recuperar el acceso.");
      }
    } catch {
      setMessage("No pudimos conectar con el servicio de acceso. Inténtalo más tarde.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={submit} noValidate>
      <label htmlFor="auth-email">Correo electrónico</label>
      <input id="auth-email" name="email" type="email" autoComplete="email" required maxLength={254} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "auth-email-error" : undefined} onChange={() => setErrors((current) => ({ ...current, email: "" }))} />
      {errors.email && <span id="auth-email-error" className="auth-field-error">{errors.email}</span>}
      {mode !== "recovery" ? <>
        <label htmlFor="auth-password">Contraseña</label>
        <input id="auth-password" name="password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} required minLength={mode === "signup" ? 12 : undefined} aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? "auth-password-error" : undefined} onChange={() => setErrors((current) => ({ ...current, password: "" }))} />
        {errors.password && <span id="auth-password-error" className="auth-field-error">{errors.password}</span>}
      </> : null}
      {mode === "signup" ? <p className="form-help">Usa al menos 12 caracteres. Revisa tu correo para confirmar la cuenta si Supabase lo solicita.</p> : null}
      {!configured ? <p className="form-message" role="status">El acceso estará disponible al configurar Supabase Auth.</p> : null}
      {message ? <p className="form-message" role="status">{message}</p> : null}
      <button className="button button-coral auth-submit" type="submit" disabled={busy || !configured}>
        {busy ? "Espera un momento…" : mode === "login" ? "Iniciar sesión" : mode === "signup" ? "Crear cuenta" : "Enviar instrucciones"}
      </button>
      <div className="auth-links">
        {mode !== "login" ? <Link href="/ingresar">Ya tengo cuenta</Link> : null}
        {mode !== "signup" ? <Link href="/registro">Crear cuenta</Link> : null}
        {mode !== "recovery" ? <Link href="/recuperar">Olvidé mi contraseña</Link> : null}
      </div>
    </form>
  );
}
