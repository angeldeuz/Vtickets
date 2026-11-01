"use client";

import { useEffect, useRef, useState } from "react";
import { searchStaffUsers, type StaffUserOption } from "@/app/admin/staff-search";

export function StaffUserPicker({ initialUsers }: { initialUsers: StaffUserOption[] }) {
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState(initialUsers.filter((user) => user.fullName?.trim()));
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const form = searchRef.current?.closest("form");
    const reset = () => { setQuery(""); setSelected(""); setUsers(initialUsers.filter((user) => user.fullName?.trim())); setError(""); };
    form?.addEventListener("reset", reset);
    return () => form?.removeEventListener("reset", reset);
  }, [initialUsers]);

  useEffect(() => {
    if (!query.trim()) { setUsers(initialUsers.filter((user) => user.fullName?.trim())); setLoading(false); setError(""); return; }
    let cancelled = false;
    const timeout = setTimeout(async () => {
      const result = await searchStaffUsers(query);
      if (!cancelled) { setUsers(result.users); setError(result.error ?? ""); setLoading(false); }
    }, 300);
    return () => { cancelled = true; clearTimeout(timeout); };
  }, [query, initialUsers]);

  return <div className="staff-user-picker">
    <label htmlFor="staff-user-search">Buscar por nombre
      <input ref={searchRef} id="staff-user-search" type="search" value={query} maxLength={120} placeholder="Escribe un nombre para filtrar"
        onChange={(event) => { setQuery(event.target.value); setSelected(""); setLoading(Boolean(event.target.value.trim())); }} />
    </label>
    <label htmlFor="staff-user-select">Usuario registrado
      <select id="staff-user-select" name="userId" value={selected} onChange={(event) => setSelected(event.target.value)}>
        <option value="">{loading ? "Buscando…" : users.length ? "Selecciona un usuario" : "No hay coincidencias"}</option>
        {!loading && users.map((user) => <option key={user.id} value={user.id}>{user.fullName}{user.phone ? ` · ${user.phone}` : ""}</option>)}
      </select>
    </label>
    {error ? <p className="admin-help" role="alert">{error}</p> :
      <p className="admin-help">La lista se filtra aquí mismo. Si la persona no aparece, pídele que complete su nombre en «Mi cuenta».</p>}
  </div>;
}
