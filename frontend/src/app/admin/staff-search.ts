"use server";

import { adminFetch } from "@/lib/admin";

export type StaffUserOption = { id: string; fullName: string | null; phone: string | null };

export async function searchStaffUsers(query: string): Promise<{ users: StaffUserOption[]; error?: string }> {
  const name = query.trim();
  if (name.length > 120) return { users: [], error: "La búsqueda admite hasta 120 caracteres." };
  try {
    const users = await adminFetch<StaffUserOption[]>(`/admin/users${name ? `?q=${encodeURIComponent(name)}` : ""}`);
    return { users: users.filter((user) => user.fullName?.trim()) };
  } catch { return { users: [], error: "No se pudo buscar personal. Inténtalo de nuevo." }; }
}
