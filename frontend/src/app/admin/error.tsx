"use client";

export default function AdminError({ reset }: { error: Error; reset: () => void }) {
  return <section className="container admin-error" role="alert"><h1>No pudimos abrir la administración</h1>
    <p>Comprueba que la API y la base de datos estén disponibles y vuelve a intentarlo.</p>
    <button className="admin-button" onClick={reset}>Reintentar</button>
  </section>;
}
