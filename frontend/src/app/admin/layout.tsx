import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin";

export const metadata: Metadata = { title: "Administración" };

// Este layout corre en el servidor. La API vuelve a verificar el rol en cada operación.
export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await requireAdmin();
  return <div className="admin-shell"><div className="container">
    <nav className="admin-nav" aria-label="Administración">
      <Link href="/admin">Eventos</Link><Link href="/admin/catalogo">Catálogo base</Link>
      <Link href="/admin/auditoria">Auditoría</Link>
    </nav>
    {children}
  </div></div>;
}
