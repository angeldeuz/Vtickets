import { z } from "zod";

const text = (max: number) => z.string().trim().min(1).max(max);
const instant = z.iso.datetime({ offset: true });
const timezone = text(100).refine((value) => {
  try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; }
  catch { return false; }
}, "Zona horaria IANA no válida");

export const eventIdSchema = z.uuid();
export const eventCreateSchema = z.strictObject({
  title: text(160),
  slug: z.string().trim().min(2).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  categoryId: z.uuid(),
  venueId: z.uuid(),
  summary: text(500).nullable().optional(),
  description: text(20_000).nullable().optional(),
  startsAt: instant,
  endsAt: instant,
  timezone,
  capacityLimit: z.number().int().positive().max(2_147_483_647),
  salesStartsAt: instant.nullable().optional(),
  salesEndsAt: instant.nullable().optional(),
});
export const eventUpdateSchema = eventCreateSchema.partial().extend({
  // updatedAt funciona como precondición para no pisar otra edición administrativa.
  updatedAt: instant,
}).refine((value) => Object.keys(value).length > 1);
export const eventListSchema = z.strictObject({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.uuid().optional(),
  status: z.enum(["draft", "published", "suspended", "cancelled", "completed"]).optional(),
});
export const eventSuspendSchema = z.strictObject({ reason: text(1000) });
export const emptyBodySchema = z.strictObject({});

export type EventCreate = z.infer<typeof eventCreateSchema>;
export type EventUpdate = z.infer<typeof eventUpdateSchema>;
export type EventList = z.infer<typeof eventListSchema>;
