import { z } from "zod";

const instant = z.iso.datetime({ offset: true });
export const staffIdSchema = z.uuid();
export const staffCreateSchema = z.strictObject({
  userId: z.uuid(), roleCode: z.literal("ACCESO"),
  startsAt: instant.nullable().optional(), endsAt: instant.nullable().optional(),
});
export const staffUpdateSchema = z.strictObject({
  status: z.enum(["assigned", "withdrawn"]),
  startsAt: instant.nullable().optional(), endsAt: instant.nullable().optional(),
});
export type StaffCreate = z.infer<typeof staffCreateSchema>;
export type StaffUpdate = z.infer<typeof staffUpdateSchema>;
