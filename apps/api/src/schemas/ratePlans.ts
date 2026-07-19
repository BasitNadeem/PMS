import { z } from "zod";
import { RatePlanType } from "@pms/db";

export const listRatePlansSchema = z.object({
  isActive: z
    .string()
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  page:  z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const ratePlanItemSchema = z.object({
  roomTypeId: z.string().uuid(),
  rate:       z.number().int().nonnegative(),
});

export const createRatePlanSchema = z.object({
  name:        z.string().trim().min(1, "Name is required"),
  type:        z.nativeEnum(RatePlanType).default("STANDARD"),
  description: z.string().trim().optional(),
  validFrom:   z.string().date().optional(),
  validTo:     z.string().date().optional(),
  daysOfWeek:  z.array(z.number().int().min(0).max(6)).default([]),
  minLos:      z.number().int().min(1).default(1),
  priority:    z.number().int().default(0),
  items:       z.array(ratePlanItemSchema).min(1, "At least one room type rate is required"),
});

export const updateRatePlanSchema = z.object({
  name:        z.string().trim().min(1).optional(),
  type:        z.nativeEnum(RatePlanType).optional(),
  description: z.string().trim().optional(),
  validFrom:   z.string().date().nullable().optional(),
  validTo:     z.string().date().nullable().optional(),
  daysOfWeek:  z.array(z.number().int().min(0).max(6)).optional(),
  minLos:      z.number().int().min(1).optional(),
  priority:    z.number().int().optional(),
  items:       z.array(ratePlanItemSchema).min(1).optional(),
});

export const suggestRateSchema = z.object({
  roomTypeId:     z.string().uuid(),
  checkIn:        z.string().date(),
  checkOut:       z.string().date(),
  bookingContext: z.enum(["SINGLE", "TOUR_AGENCY", "CORPORATE", "OTHER"]).optional(),
});

export type ListRatePlansQuery = z.infer<typeof listRatePlansSchema>;
export type CreateRatePlanDto  = z.infer<typeof createRatePlanSchema>;
export type UpdateRatePlanDto  = z.infer<typeof updateRatePlanSchema>;
export type SuggestRateQuery   = z.infer<typeof suggestRateSchema>;
