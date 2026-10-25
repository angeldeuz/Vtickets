import Link from "next/link";
import { ArrowUpRight, Ticket } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <div>
          <Link className="brand footer-brand" href="/" aria-label="Vtickets, ir al inicio">
            <span className="brand-mark" aria-hidden="true"><Ticket size={20} /></span>
            <span>vtickets<span className="brand-dot">.</span></span>
          </Link>
          <p>Eventos locales. Entradas con información clara.</p>
        </div>
        <div className="footer-links">
          <Link href="/eventos">Explorar eventos <ArrowUpRight size={16} aria-hidden="true" /></Link>
          <Link href="/cuenta">Mi cuenta <ArrowUpRight size={16} aria-hidden="true" /></Link>
          <span>El catálogo real comenzará en Saltillo, Coahuila.</span>
        </div>
      </div>
      <div className="container footer-bottom"><span>© 2026 Vtickets</span><span>Precios en MXN</span></div>
    </footer>
  );
}
