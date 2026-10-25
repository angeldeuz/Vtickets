import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Recuperar acceso" };

export default function RecoveryPage() {
  return <section className="auth-section"><div className="container auth-layout">
    <div className="auth-intro"><span className="auth-kicker">Tu cuenta</span><h1>Recupera el acceso.</h1><p>Te enviaremos instrucciones al correo asociado con tu cuenta.</p></div>
    <div className="auth-panel"><h2>Restablecer contraseña</h2><AuthForm mode="recovery" /></div>
  </div></section>;
}
