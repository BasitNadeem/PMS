import { z } from "zod";
import { PropertyType } from "@pms/db";

export const adminLoginSchema = z.object({
  email:    z.string().trim().email(),
  password: z.string().min(1),
});
export type AdminLoginDto = z.infer<typeof adminLoginSchema>;

export const createHotelSchema = z.object({
  hotelName:    z.string().trim().min(1),
  subdomain:    z.string().trim().toLowerCase().regex(/^[a-z0-9-]+$/, "Subdomain must be lowercase alphanumeric with hyphens only"),
  ownerName:    z.string().trim().min(1),
  ownerEmail:   z.string().trim().email(),
  city:         z.string().trim().optional(),
  propertyType: z.nativeEnum(PropertyType).default("HOTEL"),
});
export type CreateHotelDto = z.infer<typeof createHotelSchema>;

export const updateHotelSchema = z.object({
  isActive: z.boolean(),
});
export type UpdateHotelDto = z.infer<typeof updateHotelSchema>;
