"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
    <button className="button button-dark" type="button" onClick={signOut} disabled={busy}>
      {busy ? "Cerrando sesión…" : "Cerrar sesión"}
    </button>
    {message ? <p className="form-message" role="alert">{message}</p> : null}
  </>;
}
