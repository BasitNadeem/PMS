import { z } from "zod";
import { ReservationStatus, BookingSource, PaymentMethod } from "@pms/db";

export const listReservationsSchema = z.object({
  status:       z.nativeEnum(ReservationStatus).optional(),
  // Comma-separated list of statuses, e.g. "ENQUIRY,CONFIRMED,CHECKED_IN" (used by the Active tab)
  statuses:     z.preprocess(
    (v) => typeof v === "string" ? v.split(",").filter(Boolean) : undefined,
    z.array(z.nativeEnum(ReservationStatus)).optional(),
  ),
  checkInDate:  z.string().date().optional(),
  checkOutDate: z.string().date().optional(),
  search:       z.string().trim().optional(),
  page:         z.coerce.number().int().min(1).default(1),
  limit:        z.coerce.number().int().min(1).max(100).default(20),
  sortBy:       z.enum(["checkIn", "checkOut", "created", "status"]).default("checkIn"),
  sortDir:      z.enum(["asc", "desc"]).default("asc"),
});
export type ListReservationsQuery = z.infer<typeof listReservationsSchema>;

export const createReservationSchema = z
  .object({
    guestId:         z.string().uuid(),
    checkInDate:     z.string().date(),
    checkOutDate:    z.string().date(),
    roomId:          z.string().uuid(),
    roomTypeId:      z.string().uuid(),
    ratePerNight:    z.number().int().positive(),
    adults:          z.number().int().min(1).default(1),
    children:        z.number().int().min(0).default(0),
    source:          z.nativeEnum(BookingSource).default("WALK_IN"),
    specialRequests: z.string().trim().optional(),
    advancePayment:       z.number().int().min(0).optional(),
    advancePaymentMethod: z.nativeEnum(PaymentMethod).optional(),
    isVip:           z.boolean().optional(),
    // Which published rate the desk was quoting when it booked. Recorded for
    // the record only — the amount charged is ratePerNight above, never
    // recomputed from the plan.
    appliedRatePlanName: z.string().trim().max(160).optional(),
    // Corporate billing. billToCompany only means anything with a companyId —
    // the refine below enforces that rather than silently ignoring it.
    companyId:       z.string().uuid().nullish(),
    billToCompany:   z.boolean().optional(),
  })
  .refine((d) => !d.billToCompany || Boolean(d.companyId), {
    message: "Pick a company before billing this stay to a company account",
    path: ["companyId"],
  })
  .refine((d) => new Date(d.checkOutDate) > new Date(d.checkInDate), {
    message: "Check-out must be after check-in",
    path: ["checkOutDate"],
  });
export type CreateReservationDto = z.infer<typeof createReservationSchema>;

export const updateReservationStatusSchema = z.object({
  status: z.nativeEnum(ReservationStatus),
  reason: z.string().trim().min(3).max(500).optional(),
}).superRefine((value, ctx) => {
  if (value.status === ReservationStatus.NO_SHOW && !value.reason) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["reason"],
      message: "A reason is required when marking a reservation as no-show",
    });
  }
});
export type UpdateReservationStatusDto = z.infer<typeof updateReservationStatusSchema>;

export const updateReservationSchema = z
  .object({
    adults:          z.number().int().min(1).optional(),
    children:        z.number().int().min(0).optional(),
    source:          z.nativeEnum(BookingSource).optional(),
    specialRequests: z.string().trim().optional(),
    internalNotes:   z.string().trim().optional(),
    isVip:           z.boolean().optional(),
    companyId:       z.string().uuid().nullish(),
    billToCompany:   z.boolean().optional(),
    // Stay changes — only accepted while the reservation is still ENQUIRY,
    // CONFIRMED or WAITLISTED (enforced in ReservationService, not here,
    // since that requires the existing row's current status).
    checkInDate:  z.string().date().optional(),
    checkOutDate: z.string().date().optional(),
    roomId:       z.string().uuid().optional(),
    roomTypeId:   z.string().uuid().optional(),
    ratePerNight: z.number().int().positive().optional(),
  })
  .refine((d) => !d.roomId || Boolean(d.roomTypeId), {
    message: "roomTypeId is required when changing roomId",
    path: ["roomTypeId"],
  })
  .refine(
    (d) => !(d.checkInDate && d.checkOutDate) || new Date(d.checkOutDate) > new Date(d.checkInDate),
    { message: "Check-out must be after check-in", path: ["checkOutDate"] },
  );
export type UpdateReservationDto = z.infer<typeof updateReservationSchema>;

export const manageCheckedInStaySchema = z.object({
  newRoomId: z.string().uuid().optional(),
  checkOutDate: z.string().date().optional(),
  earlyDepartureTreatment: z.enum(["KEEP_ORIGINAL_CHARGES", "CREDIT_UNUSED_NIGHTS", "CUSTOM_CREDIT"]).default("KEEP_ORIGINAL_CHARGES"),
  earlyDepartureCreditAmount: z.number().int().positive().optional(),
  pricingMode: z.enum(["KEEP_RATE", "USE_NEW_ROOM_RATE", "CUSTOM_RATE"]).default("KEEP_RATE"),
  customRatePerNight: z.number().int().positive().optional(),
  rebateAmount: z.number().int().min(0).default(0),
  reason: z.string().trim().min(3, "Enter an internal reason").max(500),
}).superRefine((value, ctx) => {
  if (value.pricingMode === "CUSTOM_RATE" && value.customRatePerNight === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["customRatePerNight"],
      message: "Enter the approved nightly rate",
    });
  }
  if (value.earlyDepartureTreatment === "CUSTOM_CREDIT" && value.earlyDepartureCreditAmount === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["earlyDepartureCreditAmount"],
      message: "Enter the approved early departure credit",
    });
  }
  if (!value.newRoomId && !value.checkOutDate && value.rebateAmount === 0 && value.pricingMode === "KEEP_RATE") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["newRoomId"],
      message: "Change the room, check-out date, rate, or rebate",
    });
  }
});
export type ManageCheckedInStayDto = z.infer<typeof manageCheckedInStaySchema>;

export const reverseReservationLifecycleSchema = z.object({
  action: z.enum(["CHECK_IN", "CHECK_OUT"]),
  reason: z.string().trim().min(5, "Enter a clear reversal reason").max(500),
});
export type ReverseReservationLifecycleDto = z.infer<typeof reverseReservationLifecycleSchema>;
