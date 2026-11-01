import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowUpRight, LockKeyhole, LayoutDashboard } from "lucide-react";
import { LogoutButton } from "@/components/logout-button";
import { ProfileNameForm } from "@/components/profile-name-form";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Mi cuenta" };

type Profile = { id: string; fullName: string | null; phone: string | null; avatarUrl: string | null; roles: string[]; status: string };

export default async function AccountPage() {
  const supabase = await createClient();
  const { data } = supabase ? await supabase.auth.getClaims() : { data: null };
  if (!data?.claims) redirect("/ingresar");

  // getClaims verifica identidad; getSession se usa después únicamente para enviar el token a NestJS.
  const { data: sessionData } = await supabase!.auth.getSession();
  const apiUrl = process.env.VTICKETS_API_URL || "http://127.0.0.1:3001/api/v1";
  let profile: Profile | null = null;
  if (sessionData.session?.access_token) {
    try {
      const response = await fetch(`${apiUrl}/me`, { headers: { Authorization: `Bearer ${sessionData.session.access_token}` }, cache: "no-store" });
      if (response.ok) profile = await response.json() as Profile;
    } catch { /* La cuenta Auth sigue disponible aunque la API local esté apagada. */ }
  }

  return <section className="account-section"><div className="container account-inner">
    <span className="auth-kicker">Tu cuenta</span><h1>Mi cuenta</h1>
    <p className="account-email">{typeof data.claims.email === "string" ? data.claims.email : "Sesión activa"}</p>
    <div className="account-card">
      <h2>Datos de la cuenta</h2>
      {profile ? <dl className="account-data">
        <div><dt>Nombre</dt><dd>{profile.fullName || "Pendiente de completar"}</dd></div>
        <div><dt>Teléfono</dt><dd>{profile.phone || "Sin registrar"}</dd></div>
        <div><dt>Roles</dt><dd>{profile.roles.join(", ")}</dd></div>
      </dl> : <p>Tu sesión está activa. El perfil de negocio aparecerá cuando la API y la base de datos estén disponibles.</p>}
      {profile && <ProfileNameForm name={profile.fullName} />}
    </div>
    <section className="account-controls" aria-labelledby="account-controls-title">
      <h2 id="account-controls-title">Accesos y seguridad</h2>
      <div className="account-actions">
        {profile?.roles.includes("ADMINISTRADOR") && <Link className="account-action" href="/admin">
          <span className="account-action-icon" aria-hidden="true"><LayoutDashboard size={21} /></span>
          <span className="account-action-copy"><strong>Panel de administración</strong><small>Eventos, boletos y personal</small></span>
          <ArrowUpRight className="account-action-arrow" size={19} aria-hidden="true" />
        </Link>}
        <Link className="account-action" href="/actualizar-contrasena">
          <span className="account-action-icon" aria-hidden="true"><LockKeyhole size={21} /></span>
          <span className="account-action-copy"><strong>Cambiar contraseña</strong><small>Actualiza tus datos de acceso</small></span>
          <ArrowUpRight className="account-action-arrow" size={19} aria-hidden="true" />
        </Link>
      </div>
      <div className="account-signout"><LogoutButton /></div>
    </section>
  </div></section>;
}
