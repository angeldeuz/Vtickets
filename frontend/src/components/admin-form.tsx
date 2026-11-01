"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { saveAdminForm, type AdminFormOperation } from "@/app/admin/form-actions";

type Props = { operation: AdminFormOperation; children: ReactNode; className?: string; successPath?: string };

// El formulario permanece montado mientras la acción de servidor responde: así ningún valor se pierde al corregirlo.
export function AdminForm({ operation, children, className, successPath }: Props) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const root = form.current;
    if (!root) return;
    root.querySelectorAll(".admin-field-error").forEach((item) => item.remove());
    root.querySelectorAll("[aria-invalid]").forEach((item) => { item.removeAttribute("aria-invalid"); item.removeAttribute("aria-describedby"); });
    for (const [name, error] of Object.entries(errors)) {
      const input = root.elements.namedItem(name);
      if (!(input instanceof HTMLElement)) continue;
      input.setAttribute("aria-invalid", "true");
      const id = `admin-error-${name}-${Math.random().toString(36).slice(2)}`;
      input.setAttribute("aria-describedby", id);
      const note = document.createElement("span");
      note.id = id; note.className = "admin-field-error"; note.textContent = error;
      input.closest("label")?.append(note);
    }
    const first = Object.keys(errors)[0];
    if (first) (root.elements.namedItem(first) as HTMLElement | null)?.focus();
  }, [errors]);

  function clear(event: FormEvent<HTMLFormElement>) {
    const name = (event.target as HTMLInputElement).name;
    if (name && errors[name]) setErrors((current) => { const next = { ...current }; delete next[name]; return next; });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setMessage("");
    try {
      const result = await saveAdminForm(operation, new FormData(event.currentTarget));
      if (!result.ok) { setErrors(result.fields); setMessage(result.message); return; }
      if (successPath) {
        router.push(result.id ? successPath.replace(":id", result.id) : successPath);
        router.refresh();
      } else {
        if (["createCategory", "createVenue", "createTicket", "uploadImage", "assignStaff"].includes(operation)) form.current?.reset();
        setErrors({}); setMessage(result.message); router.refresh();
      }
    } catch { setMessage("No se pudo guardar. Inténtalo de nuevo; tus datos siguen aquí."); }
    finally { setBusy(false); }
  }

  return <form ref={form} className={className} onSubmit={submit} onInput={clear} onChange={clear} noValidate>
    {message && <p className={`admin-feedback${Object.keys(errors).length || busy ? " admin-feedback-error" : ""}`} role="alert">{message}</p>}
    {children}
  </form>;
}
