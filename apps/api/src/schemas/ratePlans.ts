import { z } from "zod";
import { RatePlanType } from "@pms/db";

export const listRatePlansSchema = z.object({
  isActive: z
    .string()
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  page:  z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  companyId: z.string().uuid().optional(),
});

const ratePlanItemSchema = z.object({
  roomTypeId: z.string().uuid(),
  rate:       z.number().int().nonnegative(),
});

function hasUniqueRoomTypes(items: Array<{ roomTypeId: string }>): boolean {
  return new Set(items.map((item) => item.roomTypeId)).size === items.length;
}

export const bookingCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9][A-Z0-9-]{2,31}$/, "Use 3–32 letters, numbers, or hyphens");

const ratePlanCodeDates = {
  validFrom: z.string().date().nullable().optional(),
  validTo:   z.string().date().nullable().optional(),
};

function withValidCodeDates<T extends z.ZodRawShape>(schema: z.ZodObject<T>) {
  return schema.refine(
  (data) => !data.validFrom || !data.validTo || data.validTo >= data.validFrom,
  { message: "Code end date must be on or after its start date", path: ["validTo"] },
  );
}

export const createRatePlanCodeSchema = withValidCodeDates(z.object({
  ...ratePlanCodeDates,
  code:  bookingCodeSchema,
  label: z.string().trim().max(100).optional(),
}));

export const updateRatePlanCodeSchema = withValidCodeDates(z.object({
  ...ratePlanCodeDates,
  code:     bookingCodeSchema.optional(),
  label:    z.string().trim().max(100).nullable().optional(),
  isActive: z.boolean().optional(),
}));

export const createRatePlanSchema = z.object({
  companyId:   z.string().uuid().nullable().optional(),
  name:        z.string().trim().min(1, "Name is required"),
  type:        z.nativeEnum(RatePlanType).default("STANDARD"),
  description: z.string().trim().optional(),
  validFrom:   z.string().date().optional(),
  validTo:     z.string().date().optional(),
  daysOfWeek:  z.array(z.number().int().min(0).max(6)).default([]),
  minLos:      z.number().int().min(1).default(1),
  codeRequired:z.boolean().default(false),
  priority:    z.number().int().default(0),
  items:       z.array(ratePlanItemSchema).min(1, "At least one room type rate is required"),
}).superRefine((data, ctx) => {
  if (data.validFrom && data.validTo && data.validTo < data.validFrom) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "End date must be on or after the start date", path: ["validTo"] });
  }
  if (!hasUniqueRoomTypes(data.items)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Each room type can only appear once", path: ["items"] });
  }
});

export const updateRatePlanSchema = z.object({
  companyId:   z.string().uuid().nullable().optional(),
  name:        z.string().trim().min(1).optional(),
  type:        z.nativeEnum(RatePlanType).optional(),
  description: z.string().trim().optional(),
  validFrom:   z.string().date().nullable().optional(),
  validTo:     z.string().date().nullable().optional(),
  daysOfWeek:  z.array(z.number().int().min(0).max(6)).optional(),
  minLos:      z.number().int().min(1).optional(),
  codeRequired:z.boolean().optional(),
  priority:    z.number().int().optional(),
  items:       z.array(ratePlanItemSchema).min(1).optional(),
}).superRefine((data, ctx) => {
  if (data.validFrom && data.validTo && data.validTo < data.validFrom) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "End date must be on or after the start date", path: ["validTo"] });
  }
  if (data.items && !hasUniqueRoomTypes(data.items)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Each room type can only appear once", path: ["items"] });
  }
});

export const suggestRateSchema = z.object({
  roomTypeId:     z.string().uuid(),
  checkIn:        z.string().date(),
  checkOut:       z.string().date(),
  bookingContext: z.enum(["SINGLE", "TOUR_AGENCY", "CORPORATE", "OTHER"]).optional(),
  // Authenticated booking flows may request the selected company's negotiated
  // contract. Public Booking Engine calls intentionally omit this.
  companyId:       z.string().uuid().optional(),
  promoCode:      bookingCodeSchema.optional(),
});

export type ListRatePlansQuery = z.infer<typeof listRatePlansSchema>;
export type CreateRatePlanDto  = z.infer<typeof createRatePlanSchema>;
export type UpdateRatePlanDto  = z.infer<typeof updateRatePlanSchema>;
export type SuggestRateQuery   = z.infer<typeof suggestRateSchema>;
export type CreateRatePlanCodeDto = z.infer<typeof createRatePlanCodeSchema>;
export type UpdateRatePlanCodeDto = z.infer<typeof updateRatePlanCodeSchema>;
