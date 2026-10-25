import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Crear cuenta" };

export default function SignupPage() {
  return <section className="auth-section"><div className="container auth-layout">
    <div className="auth-intro"><span className="auth-kicker">Tu cuenta</span><h1>Prepara tu próxima entrada.</h1><p>Crea una cuenta para gestionar tus compras y tickets cuando la venta esté disponible.</p></div>
    <div className="auth-panel"><h2>Crear cuenta</h2><AuthForm mode="signup" /></div>
  </div></section>;
}
