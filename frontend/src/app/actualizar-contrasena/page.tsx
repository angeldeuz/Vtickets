import type { Metadata } from "next";
import { PasswordUpdateForm } from "@/components/password-update-form";

export const metadata: Metadata = { title: "Nueva contraseña" };

export default async function UpdatePasswordPage() {
  return <section className="auth-section"><div className="container auth-layout">
    <div className="auth-intro"><span className="auth-kicker">Tu cuenta</span><h1>Elige una contraseña nueva.</h1><p>Al guardarla podrás volver a tu cuenta.</p></div>
    <div className="auth-panel"><h2>Nueva contraseña</h2><PasswordUpdateForm /></div>
  </div></section>;
}
