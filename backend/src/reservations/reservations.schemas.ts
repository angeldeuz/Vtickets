import { z } from "zod";

const itemSchema = z.strictObject({
  ticketTypeId: z.uuid(),
  quantity: z.number().int().min(1).max(4),
});

export const reservationCreateSchema = z.strictObject({
  eventId: z.uuid(),
  items: z.array(itemSchema).min(1).max(4),
}).superRefine((value, context) => {
  if (new Set(value.items.map((item) => item.ticketTypeId)).size !== value.items.length) {
    context.addIssue({ code: "custom", path: ["items"], message: "No repitas un tipo de entrada" });
  }
  if (value.items.reduce((sum, item) => sum + item.quantity, 0) > 4) {
    context.addIssue({ code: "custom", path: ["items"], message: "Puedes reservar hasta 4 entradas" });
  }
});

export const idempotencyKeySchema = z.string().min(8).max(128).regex(/^[A-Za-z0-9._~-]+$/);
export type ReservationCreate = z.infer<typeof reservationCreateSchema>;
