import { z } from "zod";

const instant = z.iso.datetime({ offset: true });
const positive = z.number().int().min(1).max(4);

export const ticketTypeIdSchema = z.uuid();
export const ticketTypeCreateSchema = z.strictObject({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).nullable().optional(),
  priceCents: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  currency: z.literal("MXN").default("MXN"),
  quantityTotal: z.number().int().min(1).max(2_147_483_647),
  maxPerOrder: positive.default(4),
  maxPerUser: positive.default(4),
  salesStartsAt: instant.nullable().optional(),
  salesEndsAt: instant.nullable().optional(),
  status: z.enum(["active", "paused"]).default("active"),
});
export const ticketTypeUpdateSchema = ticketTypeCreateSchema.partial().extend({
  updatedAt: instant,
}).refine((value) => Object.keys(value).length > 1);

export type TicketTypeCreate = z.infer<typeof ticketTypeCreateSchema>;
export type TicketTypeUpdate = z.infer<typeof ticketTypeUpdateSchema>;
