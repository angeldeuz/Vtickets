import { z } from "zod";

export const publicEventListSchema = z.strictObject({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().min(1).max(2048).optional(),
  city: z.string().trim().min(1).max(120).optional(),
  category: z.string().trim().min(1).max(120).optional(),
  from: z.iso.datetime({ offset: true }).optional(),
  q: z.string().trim().min(1).max(100).optional(),
});

export type PublicEventList = z.infer<typeof publicEventListSchema>;
