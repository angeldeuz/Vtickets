import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  const { estado } = await searchParams;
  return <section className="auth-section"><div className="container auth-layout">
    <div className="auth-intro"><span className="auth-kicker">Tu cuenta</span><h1>Vuelve a tus eventos.</h1><p>Accede para consultar tus entradas cuando la venta esté disponible.</p></div>
    <div className="auth-panel"><h2>Iniciar sesión</h2>{estado === "enlace-invalido" ? <p className="form-message" role="status">El enlace venció o no es válido. Solicita uno nuevo.</p> : null}<AuthForm mode="login" /></div>
  </div></section>;
}
