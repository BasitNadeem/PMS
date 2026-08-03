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
});
export type UpdateReservationStatusDto = z.infer<typeof updateReservationStatusSchema>;

export const updateReservationSchema = z.object({
  adults:          z.number().int().min(1).optional(),
  children:        z.number().int().min(0).optional(),
  source:          z.nativeEnum(BookingSource).optional(),
  specialRequests: z.string().trim().optional(),
  internalNotes:   z.string().trim().optional(),
  isVip:           z.boolean().optional(),
  companyId:       z.string().uuid().nullish(),
  billToCompany:   z.boolean().optional(),
});
export type UpdateReservationDto = z.infer<typeof updateReservationSchema>;
