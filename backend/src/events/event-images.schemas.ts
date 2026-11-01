import { z } from "zod";

export const imageIdSchema = z.uuid();
export const imageQuerySchema = z.strictObject({
  altText: z.string().trim().min(1).max(300).optional(),
  isCover: z.enum(["true", "false"]).transform((value) => value === "true").default(false),
  sortOrder: z.coerce.number().int().min(0).max(1000).default(0),
});
export type ImageQuery = z.infer<typeof imageQuerySchema>;
