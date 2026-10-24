import Link from "next/link";
import { ArrowUpRight, Ticket } from "lucide-react";

export function SiteFooter() {
  return <footer className="site-footer"><div className="container footer-inner"><div><Link className="brand footer-brand" href="/"><span className="brand-mark"><Ticket size={20} /></span><span>vtickets<span className="brand-dot">.</span></span></Link><p>Tu siguiente gran recuerdo empieza aquí.</p></div><div className="footer-links"><Link href="/eventos">Explorar eventos <ArrowUpRight size={15} /></Link><span>Ciudad de México · Hecho para descubrir</span></div></div><div className="container footer-bottom"><span>© 2026 Vtickets</span><span>Experiencias que se quedan contigo.</span></div></footer>;
}
