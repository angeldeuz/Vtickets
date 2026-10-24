export type TicketType = {
  name: string;
  price: number;
  available: number;
};

export type Event = {
  id: string;
  slug: string;
  title: string;
  category: string;
  date: string;
  time: string;
  venue: string;
  city: string;
  description: string;
  artwork: "coral" | "lime" | "violet" | "blue" | "orange" | "pink";
  tickets: TicketType[];
};

// Datos visuales para revisar el frontend antes de que exista el contrato de la API.
// No representan eventos publicados ni habilitan compras.
const demoEvents: Event[] = [
  {
    id: "demo-1", slug: "noches-de-jazz", title: "Noches de Jazz", category: "Música",
    date: "2026-11-14", time: "20:00", venue: "Foro La Estación", city: "Ciudad de México",
    description: "Una noche para dejarse llevar por el ritmo. Una selección de músicos locales se reúne en un espacio íntimo para celebrar el jazz en vivo.",
    artwork: "coral", tickets: [{ name: "Entrada general", price: 380, available: 48 }, { name: "Mesa preferente", price: 650, available: 12 }]
  },
  {
    id: "demo-2", slug: "festival-de-sabores", title: "Festival de Sabores", category: "Gastronomía",
    date: "2026-11-21", time: "13:00", venue: "Jardín Alameda", city: "Ciudad de México",
    description: "Cocina, encuentros y nuevas historias alrededor de la mesa. Descubre propuestas de creadores gastronómicos de la ciudad.",
    artwork: "lime", tickets: [{ name: "Acceso general", price: 250, available: 85 }]
  },
  {
    id: "demo-3", slug: "arte-en-movimiento", title: "Arte en Movimiento", category: "Arte y cultura",
    date: "2026-12-05", time: "18:30", venue: "Centro Cultural Norte", city: "Ciudad de México",
    description: "Una experiencia que cruza la danza, el arte visual y el sonido para explorar nuevas formas de encontrarnos.",
    artwork: "violet", tickets: [{ name: "Entrada general", price: 320, available: 32 }]
  },
  {
    id: "demo-4", slug: "entre-lineas", title: "Entre Líneas", category: "Arte y cultura",
    date: "2026-12-12", time: "19:00", venue: "Teatro Independiente", city: "Ciudad de México",
    description: "Teatro contemporáneo para mirar de cerca esas conversaciones que siempre quedan pendientes.",
    artwork: "blue", tickets: [{ name: "Entrada general", price: 290, available: 61 }]
  },
  {
    id: "demo-5", slug: "atardecer-electronico", title: "Atardecer Electrónico", category: "Música",
    date: "2026-12-19", time: "17:00", venue: "Terraza del Bosque", city: "Ciudad de México",
    description: "Música electrónica, buena compañía y una ciudad que cambia de color al caer la tarde.",
    artwork: "orange", tickets: [{ name: "Acceso general", price: 420, available: 74 }]
  },
  {
    id: "demo-6", slug: "mercado-creativo", title: "Mercado Creativo", category: "Experiencias",
    date: "2027-01-09", time: "11:00", venue: "Casa Taller", city: "Ciudad de México",
    description: "Diseño local, talleres y piezas hechas con intención en una jornada para descubrir nuevas ideas.",
    artwork: "pink", tickets: [{ name: "Acceso general", price: 180, available: 90 }]
  }
];

export type EventResult = { events: Event[]; isDemo: boolean; error: boolean };

// Esta función corre en el servidor de Next.js. Más adelante, NestJS publicará
// GET /public/events y GET /public/events/:slug con este contrato documentado.
export async function getEvents(): Promise<EventResult> {
  const apiUrl = process.env.VTICKETS_API_URL?.trim();
  if (!apiUrl) return { events: demoEvents, isDemo: true, error: false };

  try {
    const response = await fetch(`${apiUrl.replace(/\/$/, "")}/public/events`, { cache: "no-store" });
    if (!response.ok) throw new Error(`API ${response.status}`);
    const data: unknown = await response.json();
    if (!Array.isArray(data)) throw new Error("Formato de eventos inválido");
    return { events: data as Event[], isDemo: false, error: false };
  } catch {
    return { events: [], isDemo: false, error: true };
  }
}

export async function getEvent(slug: string): Promise<{ event: Event | null; isDemo: boolean; error: boolean }> {
  const result = await getEvents();
  return { event: result.events.find((event) => event.slug === slug) ?? null, isDemo: result.isDemo, error: result.error };
}

export function formatDate(date: string): string {
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
}

export function formatMoney(amount: number): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(amount);
}
