"use server";

import { revalidatePath } from "next/cache";
import { adminFetch } from "@/lib/admin";

export async function saveProfileName(form: FormData): Promise<{ ok: boolean; message: string }> {
  const fullName = String(form.get("fullName") ?? "").trim();
  if (!fullName || fullName.length > 120) return { ok: false, message: "Escribe un nombre de 1 a 120 caracteres." };
  try {
    await adminFetch("/me", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fullName }) });
    revalidatePath("/cuenta");
    return { ok: true, message: "Nombre guardado." };
  } catch { return { ok: false, message: "No se pudo guardar el nombre. Inténtalo de nuevo." }; }
}
