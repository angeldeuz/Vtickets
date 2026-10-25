import Link from "next/link";
import { ArrowUpRight, Ticket } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link className="brand" href="/" aria-label="Vtickets, ir al inicio">
          <span className="brand-mark" aria-hidden="true"><Ticket size={21} strokeWidth={2.5} /></span>
          <span>vtickets<span className="brand-dot">.</span></span>
        </Link>
        <nav className="header-nav" aria-label="Navegación principal">
          <Link href="/eventos">Explorar eventos</Link>
          <Link href="/#como-funciona">Cómo funciona</Link>
        </nav>
        <div className="header-right">
          <Link className="header-account" href="/cuenta">Mi cuenta</Link>
          <Link className="header-action" href="/eventos">Ver eventos <ArrowUpRight size={17} aria-hidden="true" /></Link>
        </div>
      </div>
    </header>
  );
}
