import { z } from "zod";

const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => text(max).nullable().optional();
const timezone = text(100).refine((value) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}, "Zona horaria IANA no válida");

export const categoryCreateSchema = z.strictObject({
  name: text(120),
  slug: z.string().trim().min(2).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: optionalText(2000),
  isActive: z.boolean().optional(),
});
export const categoryUpdateSchema = categoryCreateSchema.partial().refine((value) => Object.keys(value).length > 0);

export const venueCreateSchema = z.strictObject({
  name: text(160),
  addressLine1: optionalText(200),
  addressLine2: optionalText(200),
  city: optionalText(120),
  region: optionalText(120),
  countryCode: z.string().regex(/^[A-Z]{2}$/).nullable().optional(),
  postalCode: optionalText(20),
  latitude: z.number().finite().min(-90).max(90).nullable().optional(),
  longitude: z.number().finite().min(-180).max(180).nullable().optional(),
  timezone: timezone.nullable().optional(),
  capacity: z.number().int().positive().max(2_147_483_647).nullable().optional(),
});
export const venueUpdateSchema = venueCreateSchema.partial().refine((value) => Object.keys(value).length > 0);

export const idSchema = z.uuid();
export const listSchema = z.strictObject({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.uuid().optional(),
});

export type CategoryCreate = z.infer<typeof categoryCreateSchema>;
export type CategoryUpdate = z.infer<typeof categoryUpdateSchema>;
export type VenueCreate = z.infer<typeof venueCreateSchema>;
export type VenueUpdate = z.infer<typeof venueUpdateSchema>;
export type ListOptions = z.infer<typeof listSchema>;
