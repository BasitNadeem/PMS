import { z } from "zod";
import { PropertyType } from "@pms/db";
import { emailSchema } from "../lib/validation";

export const adminLoginSchema = z.object({
  email:    z.string().trim().email(),
  password: z.string().min(1),
});
export type AdminLoginDto = z.infer<typeof adminLoginSchema>;

export const createHotelSchema = z.object({
  hotelName:          z.string().trim().min(1),
  subdomain:          z.string().trim().toLowerCase().regex(/^[a-z0-9-]+$/, "Subdomain must be lowercase alphanumeric with hyphens only"),
  ownerName:          z.string().trim().min(1),
  ownerEmail:         emailSchema,
  city:               z.string().trim().optional(),
  propertyType:       z.nativeEnum(PropertyType).default("HOTEL"),
  subscriptionPlanId: z.string().uuid().optional(),
});
export type CreateHotelDto = z.infer<typeof createHotelSchema>;

export const updateHotelSchema = z.object({
  isActive:           z.boolean().optional(),
  subscriptionPlanId: z.string().uuid().nullable().optional(),
  roomLimitOverride:  z.number().int().min(1).nullable().optional(),
  featureOverrides:   z.record(z.string(), z.boolean()).nullable().optional(),
});
export type UpdateHotelDto = z.infer<typeof updateHotelSchema>;

export const createPlanSchema = z.object({
  name:         z.string().trim().min(1),
  slug:         z.string().trim().min(1).regex(/^[a-z0-9-]+$/),
  priceMonthly: z.number().int().min(0),
  maxRooms:     z.number().int().min(1),
  maxUsers:     z.number().int().min(1),
  features:     z.record(z.string(), z.boolean()),
  isActive:     z.boolean().default(true),
  displayOrder: z.number().int().default(0),
});
export type CreatePlanDto = z.infer<typeof createPlanSchema>;

export const updatePlanSchema = createPlanSchema.partial();
export type UpdatePlanDto = z.infer<typeof updatePlanSchema>;
