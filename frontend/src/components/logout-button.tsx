"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function signOut() {
    setBusy(true);
    setMessage("");
    try {
      const { error } = await createClient().auth.signOut();
      if (error) {
        setMessage("No pudimos cerrar la sesión. Inténtalo de nuevo.");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setMessage("No pudimos conectar con el servicio de acceso. Inténtalo más tarde.");
    } finally {
      setBusy(false);
    }
  }
  return <>
    <button className="account-action account-signout-button" type="button" onClick={signOut} disabled={busy}>
      <span className="account-action-icon" aria-hidden="true"><LogOut size={21} /></span>
      <span className="account-action-copy"><strong>{busy ? "Cerrando sesión…" : "Cerrar sesión"}</strong>
        <small>Salir de esta cuenta en este dispositivo</small></span>
    </button>
    {message ? <p className="form-message" role="alert">{message}</p> : null}
  </>;
}
