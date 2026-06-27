import { z } from "zod";

export const updateSettingsSchema = z.object({
  // Hotel model fields
  name:         z.string().trim().min(1).optional(),
  propertyType: z.enum(["HOTEL", "GUESTHOUSE", "RESORT", "LODGE", "HOSTEL", "SERVICED_APARTMENT", "CAMPSITE"]).optional(),
  phone:        z.string().trim().optional(),
  email:        z.string().trim().email().optional().or(z.literal("")),
  website:      z.string().trim().optional(),
  address:      z.string().trim().optional(),
  city:         z.string().trim().optional(),
  country:      z.string().trim().optional(),
  // settings JSON fields — stored in hotel.settings
  starRating:        z.number().int().min(1).max(5).nullable().optional(),
  description:       z.string().trim().optional(),
  timezone:          z.string().trim().optional(),
  checkInTime:       z.string().trim().optional(),
  checkOutTime:      z.string().trim().optional(),
  lateCheckoutFee:   z.number().int().min(0).optional(),
  earlyCheckinFee:   z.number().int().min(0).optional(),
  defaultSource:     z.enum(["WALK_IN", "PHONE", "WHATSAPP", "BOOKING_COM", "AGODA", "EXPEDIA"]).optional(),
  autoConfirm:       z.boolean().optional(),
  maxAdvanceDays:    z.number().int().min(1).optional(),
  gstEnabled:        z.boolean().optional(),
  gstRate:           z.number().min(0).max(100).optional(),
  pstEnabled:        z.boolean().optional(),
  pstRate:           z.number().min(0).max(100).optional(),
  taxInclusive:      z.boolean().optional(),
  fbrEnabled:        z.boolean().optional(),
  invoicePrefix:          z.string().trim().optional(),
  ownerWhatsappNumber:    z.string().trim().nullable().optional(),
  themeKey:               z.enum(["WARM_CLAY", "PINE_TEAL", "AZURE_SLATE", "INDIGO_NIGHT"]).optional(),
  // onboarding progress — Hotel model field
  onboardingStep:         z.number().int().min(0).max(4).optional(),
});

export type UpdateSettingsDto = z.infer<typeof updateSettingsSchema>;

export const updateRolePermissionsSchema = z.object({
  permissions: z.array(z.object({
    key:     z.string(),
    enabled: z.boolean(),
  })),
});

export type UpdateRolePermissionsDto = z.infer<typeof updateRolePermissionsSchema>;
