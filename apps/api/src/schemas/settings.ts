import { z } from "zod";
import { optionalPhoneSchema, optionalEmailSchema } from "../lib/validation";

const hotelTimeSchema = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Use HH:mm in 24-hour time");

export const updateSettingsSchema = z.object({
  // Hotel model fields
  name:         z.string().trim().min(1).optional(),
  propertyType: z.enum(["HOTEL", "GUESTHOUSE", "RESORT", "LODGE", "HOSTEL", "SERVICED_APARTMENT", "CAMPSITE"]).optional(),
  description:  z.string().trim().optional(),
  amenities:    z.array(z.string().trim()).optional(),
  phone:        optionalPhoneSchema,
  email:        optionalEmailSchema,
  website:      z.string().trim().optional(),
  address:      z.string().trim().optional(),
  city:         z.string().trim().optional(),
  country:      z.string().trim().optional(),
  cancellationPolicy:  z.string().trim().max(5000).nullable().optional(),
  bookingPaymentTerms: z.string().trim().max(10000).nullable().optional(),
  // settings JSON fields — stored in hotel.settings
  starRating:        z.number().int().min(1).max(5).nullable().optional(),
  timezone:          z.string().trim().optional(),
  checkInTime:       z.string().trim().optional(),
  checkOutTime:      z.string().trim().optional(),
  shiftMorningStart: hotelTimeSchema.optional(),
  shiftEveningStart: hotelTimeSchema.optional(),
  shiftNightStart:   hotelTimeSchema.optional(),
  requireIndependentShiftSignoff: z.boolean().optional(),
  shiftHandoverRemindersEnabled: z.boolean().optional(),
  nightAuditRemindersEnabled:    z.boolean().optional(),
  shiftReminderLeadMinutes: z.union([
    z.literal(15),
    z.literal(30),
    z.literal(60),
  ]).optional(),
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
  posTaxRate:        z.number().min(0).max(100).optional(),
  fbrEnabled:        z.boolean().optional(),
  invoicePrefix:          z.string().trim().optional(),
  ownerWhatsappNumber:    optionalPhoneSchema,
  birthdayOffersEnabled:     z.boolean().optional(),
  anniversaryOffersEnabled:  z.boolean().optional(),
  occasionOfferDiscountPercent: z.number().int().min(1).max(90).optional(),
  occasionOfferLeadDays:        z.number().int().min(0).max(90).optional(),
  occasionOfferValidityDays:    z.number().int().min(1).max(365).optional(),
  themeKey:               z.enum(["WARM_CLAY", "PINE_TEAL", "AZURE_SLATE", "INDIGO_NIGHT"]).optional(),
  logoUrl:                z.string().nullable().optional(),
  // onboarding progress — Hotel model field
  onboardingStep:         z.number().int().min(0).max(4).optional(),
}).superRefine((value, ctx) => {
  const values = [
    value.shiftMorningStart,
    value.shiftEveningStart,
    value.shiftNightStart,
  ];
  if (values.every((item) => item === undefined)) return;
  if (values.some((item) => item === undefined)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["shiftMorningStart"],
      message: "Morning, Evening, and Night shift starts must be updated together",
    });
    return;
  }

  const minutes = (item: string | undefined) => {
    if (!item) return -1;
    const [hour, minute] = item.split(":").map(Number);
    return hour * 60 + minute;
  };
  const morning = minutes(value.shiftMorningStart);
  const evening = minutes(value.shiftEveningStart);
  const night = minutes(value.shiftNightStart);
  if (!(morning < evening && evening < night)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["shiftMorningStart"],
      message: "Shift starts must be ordered Morning, Evening, then Night",
    });
  }
});

export type UpdateSettingsDto = z.infer<typeof updateSettingsSchema>;

export const updateRolePermissionsSchema = z.object({
  permissions: z.array(z.object({
    key:     z.string(),
    enabled: z.boolean(),
  })),
});

export type UpdateRolePermissionsDto = z.infer<typeof updateRolePermissionsSchema>;
