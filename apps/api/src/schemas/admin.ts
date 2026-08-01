import { z } from "zod";
import {
  FEATURE_KEYS,
  LIMIT_DEFINITIONS,
  LIMIT_KEYS,
  PropertyType,
  type FeatureKey,
  type LimitKey,
} from "@pms/db";
import { emailSchema } from "../lib/validation";

const featureKeyValues: [FeatureKey, ...FeatureKey[]] = [FEATURE_KEYS[0], ...FEATURE_KEYS.slice(1)];
const limitKeyValues: [LimitKey, ...LimitKey[]] = [LIMIT_KEYS[0], ...LIMIT_KEYS.slice(1)];
const featureFlagsSchema = z.record(z.enum(featureKeyValues), z.boolean());
const limitsSchema = z.record(z.enum(limitKeyValues), z.number().int().nullable()).superRefine((limits, context) => {
  for (const definition of LIMIT_DEFINITIONS) {
    const value = limits[definition.key];
    if (typeof value === "number" && value < definition.minimum) {
      context.addIssue({
        code: z.ZodIssueCode.too_small,
        type: "number",
        minimum: definition.minimum,
        inclusive: true,
        exact: false,
        path: [definition.key],
        message: `${definition.label} must be at least ${definition.minimum}`,
      });
    }
  }
});

export const adminLoginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});
export type AdminLoginDto = z.infer<typeof adminLoginSchema>;

export const createHotelSchema = z.object({
  hotelName: z.string().trim().min(1),
  subdomain: z.string().trim().toLowerCase().regex(/^[a-z0-9-]+$/, "Subdomain must be lowercase alphanumeric with hyphens only"),
  ownerName: z.string().trim().min(1),
  ownerEmail: emailSchema,
  city: z.string().trim().optional(),
  propertyType: z.nativeEnum(PropertyType).default("HOTEL"),
  subscriptionPlanId: z.string().uuid().optional(),
});
export type CreateHotelDto = z.infer<typeof createHotelSchema>;

export const updateHotelSchema = z.object({
  isActive: z.boolean().optional(),
  subscriptionPlanId: z.string().uuid().nullable().optional(),
  limitOverrides: limitsSchema.nullable().optional(),
  featureOverrides: featureFlagsSchema.nullable().optional(),
});
export type UpdateHotelDto = z.infer<typeof updateHotelSchema>;

export const createPlanSchema = z.object({
  name: z.string().trim().min(1),
  slug: z.string().trim().min(1).regex(/^[a-z0-9-]+$/),
  priceMonthly: z.number().int().min(0),
  limits: limitsSchema,
  features: featureFlagsSchema,
  isActive: z.boolean().default(true),
  displayOrder: z.number().int().default(0),
});
export type CreatePlanDto = z.infer<typeof createPlanSchema>;

export const updatePlanSchema = createPlanSchema.partial();
export type UpdatePlanDto = z.infer<typeof updatePlanSchema>;
