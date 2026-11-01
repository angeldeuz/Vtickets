import Link from "next/link";
import { adminFetch, type Page } from "@/lib/admin";
import { describeAudit, type AuditRow } from "@/lib/audit-display";

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ cursor?: string }> }) {
  const query = await searchParams;
  const rows = await adminFetch<Page<AuditRow>>(`/admin/audit?limit=30${query.cursor ? `&cursor=${encodeURIComponent(query.cursor)}` : ""}`);
  return <section className="admin-page"><div className="admin-heading"><div><h1>Auditoría</h1>
    <p>Historial de cambios administrativos relevantes.</p></div></div>
    {rows.items.length ? <div className="admin-list">{rows.items.map((row) => {
      const description = describeAudit(row);
      return <article className="admin-audit-row" key={row.id}>
        <div><strong>{description.title}</strong><small>{description.label}</small>
          {description.facts.length > 0 && <details className="admin-audit-details"><summary>Ver qué cambió</summary>
            <ul>{description.facts.map((fact, index) => <li key={`${fact.label}-${index}`}><strong>{fact.label}</strong><span>{fact.text}</span></li>)}</ul>
          </details>}</div>
        <div><time dateTime={row.createdAt}>{new Date(row.createdAt).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}</time>
          <small>{row.refActorUserId?.fullName || (row.actorUserId ? "Cuenta sin nombre" : "Sistema")}</small></div>
      </article>;
    })}</div> : <div className="admin-empty"><h2>Sin cambios registrados</h2><p>Las acciones administrativas aparecerán aquí.</p></div>}
    {rows.nextCursor && <Link className="admin-next" href={`/admin/auditoria?cursor=${rows.nextCursor}`}>Ver registros anteriores</Link>}
  </section>;
}
