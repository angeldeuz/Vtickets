import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Vtickets | Vive algo nuevo", template: "%s | Vtickets" },
  description: "Descubre eventos y experiencias locales en Vtickets."
};

// Layout: Next.js envuelve cada página con esta estructura compartida.
// Se ejecuta en el servidor; los enlaces funcionan sin JavaScript del cliente.
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-MX">
      <body>
        <a className="skip-link" href="#contenido">Saltar al contenido</a>
        <SiteHeader />
        <main id="contenido">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
