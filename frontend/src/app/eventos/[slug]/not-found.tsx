import Link from "next/link";

export default function EventNotFound() {
  return <div className="container message-state detail-error"><h1>Este evento no está disponible</h1><p>Puede que haya cambiado o ya no esté publicado.</p><Link className="button button-dark" href="/eventos">Explorar eventos</Link></div>;
}
