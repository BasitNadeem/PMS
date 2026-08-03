import { z } from "zod";
import { phoneSchema, optionalEmailSchema } from "../lib/validation";
import { bookingCodeSchema } from "./ratePlans";

const optionalPastDateSchema = z.string().date().refine(
  (value) => {
    const year = Number(value.slice(0, 4));
    return year >= 1900 && new Date(`${value}T00:00:00.000Z`) <= new Date();
  },
  "Date must be between 1900 and today",
).optional();

const consentRequiresEmail = (data: { marketingOptIn: boolean; guestEmail?: string }, ctx: z.RefinementCtx) => {
  if (data.marketingOptIn && !data.guestEmail) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["guestEmail"],
      message: "An email address is required to receive offers",
    });
  }
};

export const bookingAvailabilitySchema = z.object({
  checkIn:  z.string().date(),
  checkOut: z.string().date(),
}).refine(
  (d) => new Date(d.checkOut) > new Date(d.checkIn),
  { message: "checkOut must be after checkIn", path: ["checkOut"] }
);
export type BookingAvailabilityQuery = z.infer<typeof bookingAvailabilitySchema>;

export const publicSuggestRateSchema = z.object({
  roomTypeId: z.string().uuid(),
  checkIn:    z.string().date(),
  checkOut:   z.string().date(),
  promoCode:  bookingCodeSchema.optional(),
}).refine(
  (d) => new Date(d.checkOut) > new Date(d.checkIn),
  { message: "checkOut must be after checkIn", path: ["checkOut"] }
);
export type PublicSuggestRateQuery = z.infer<typeof publicSuggestRateSchema>;

export const publicPromoCodeSchema = z.object({
  code:      bookingCodeSchema,
  checkIn:   z.string().date(),
  checkOut:  z.string().date(),
}).refine(
  (d) => new Date(d.checkOut) > new Date(d.checkIn),
  { message: "checkOut must be after checkIn", path: ["checkOut"] },
);
export type PublicPromoCodeQuery = z.infer<typeof publicPromoCodeSchema>;

export const createBookingRequestSchema = z.object({
  roomTypeId:      z.string().uuid(),
  checkInDate:     z.string().date(),
  checkOutDate:    z.string().date(),
  guestName:       z.string().trim().min(1),
  guestPhone:      phoneSchema,
  guestEmail:      optionalEmailSchema,
  adults:          z.number().int().min(1).default(1),
  children:        z.number().int().min(0).default(0),
  specialRequests: z.string().trim().optional(),
  dateOfBirth:     optionalPastDateSchema,
  anniversaryDate: optionalPastDateSchema,
  marketingOptIn: z.boolean().default(false),
  promoCode:       bookingCodeSchema.optional(),
  termsAccepted:   z.boolean().default(false),
}).refine(
  (d) => new Date(d.checkOutDate) > new Date(d.checkInDate),
  { message: "checkOutDate must be after checkInDate", path: ["checkOutDate"] }
).superRefine(consentRequiresEmail);
export type CreateBookingRequestDto = z.infer<typeof createBookingRequestSchema>;

export const bookMultiSchema = z.object({
  checkInDate:     z.string().date(),
  checkOutDate:    z.string().date(),
  items:           z.array(z.object({
    roomTypeId: z.string().uuid(),
    quantity:   z.number().int().min(1).max(10),
  })).min(1).max(20),
  guestName:       z.string().trim().min(1),
  guestPhone:      phoneSchema,
  guestEmail:      optionalEmailSchema,
  adults:          z.number().int().min(1).default(1),
  children:        z.number().int().min(0).default(0),
  specialRequests: z.string().trim().optional(),
  dateOfBirth:     optionalPastDateSchema,
  anniversaryDate: optionalPastDateSchema,
  marketingOptIn: z.boolean().default(false),
  promoCode:       bookingCodeSchema.optional(),
  termsAccepted:   z.boolean().default(false),
}).refine(
  (d) => new Date(d.checkOutDate) > new Date(d.checkInDate),
  { message: "checkOutDate must be after checkInDate", path: ["checkOutDate"] }
).superRefine(consentRequiresEmail);
export type BookMultiDto = z.infer<typeof bookMultiSchema>;
