export type TicketType = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  available: number;
  maxPerOrder: number;
  maxPerUser: number;
  saleStatus: "available" | "upcoming" | "sold_out" | "closed";
};

export type Event = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  description: string | null;
  category: string;
  startsAt: string;
  timezone: string;
  venue: string;
  address: string | null;
  city: string | null;
  region: string | null;
  cover: { alt: string } | null;
  tickets: TicketType[];
};

export type EventResult = { events: Event[]; nextCursor: string | null; error: boolean };
export type EventListOptions = { limit?: number; cursor?: string; q?: string; category?: string; city?: string; from?: string };

const apiUrl = process.env.VTICKETS_API_URL?.trim() || "http://127.0.0.1:3001/api/v1";

// Esta función corre en el servidor de Next.js. La petición HTTP llega al
// controlador público de NestJS, que lee PostgreSQL; luego React genera el HTML.
export async function getEvents(options: EventListOptions = {}): Promise<EventResult> {
  try {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(options)) if (value !== undefined && value !== "") query.set(key, String(value));
    const response = await fetch(`${apiUrl.replace(/\/$/, "")}/public/events${query.size ? `?${query}` : ""}`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`API ${response.status}`);
    const data: unknown = await response.json();
    if (!data || typeof data !== "object" || !("items" in data) || !Array.isArray(data.items) || !("nextCursor" in data) || (data.nextCursor !== null && typeof data.nextCursor !== "string")) throw new Error("Formato de eventos inválido");
    return { events: data.items as Event[], nextCursor: data.nextCursor, error: false };
  } catch {
    return { events: [], nextCursor: null, error: true };
  }
}

export async function getEventCategories(): Promise<{ categories: string[]; error: boolean }> {
  try {
    const response = await fetch(`${apiUrl.replace(/\/$/, "")}/categories`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`API ${response.status}`);
    const data: unknown = await response.json();
    if (!Array.isArray(data)) throw new Error("Formato de categorías inválido");
    return { categories: data.map((category: { name: string }) => category.name), error: false };
  } catch {
    return { categories: [], error: true };
  }
}

export async function getEvent(slug: string): Promise<{ event: Event | null; error: boolean }> {
  try {
    const response = await fetch(`${apiUrl.replace(/\/$/, "")}/public/events/${encodeURIComponent(slug)}`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (response.status === 404) return { event: null, error: false };
    if (!response.ok) throw new Error(`API ${response.status}`);
    return { event: await response.json() as Event, error: false };
  } catch {
    return { event: null, error: true };
  }
}

export function formatDate(event: Event): string {
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", year: "numeric", timeZone: event.timezone }).format(new Date(event.startsAt));
}

export function formatTime(event: Event): string {
  return new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: event.timezone }).format(new Date(event.startsAt));
}

export function formatMoney(amount: number): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
}

export function availablePrice(event: Event): number | null {
  const prices = event.tickets.filter((ticket) => ticket.saleStatus === "available").map((ticket) => ticket.price);
  return prices.length ? Math.min(...prices) : null;
}

export function eventAvailability(event: Event): string {
  if (event.tickets.length === 0) return "Entradas no disponibles";
  if (new Date(event.startsAt).getTime() <= Date.now() || event.tickets.every((ticket) => ticket.saleStatus === "closed")) return "Venta finalizada";
  if (event.tickets.some((ticket) => ticket.saleStatus === "available")) return "Disponible";
  if (event.tickets.some((ticket) => ticket.saleStatus === "upcoming")) return "Venta próximamente";
  return "Agotado";
}
