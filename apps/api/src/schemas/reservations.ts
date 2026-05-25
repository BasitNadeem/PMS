import { z } from "zod";
import { ReservationStatus, BookingSource } from "@pms/db";

export const listReservationsSchema = z.object({
  status: z.nativeEnum(ReservationStatus).optional(),
  date:   z.string().date().optional(),
  page:   z.coerce.number().int().min(1).default(1),
  limit:  z.coerce.number().int().min(1).max(100).default(20),
});
export type ListReservationsQuery = z.infer<typeof listReservationsSchema>;

export const createReservationSchema = z.object({
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
}).refine(
  (d) => new Date(d.checkOutDate) > new Date(d.checkInDate),
  { message: "Check-out must be after check-in", path: ["checkOutDate"] }
);
export type CreateReservationDto = z.infer<typeof createReservationSchema>;

export const updateReservationStatusSchema = z.object({
  status: z.nativeEnum(ReservationStatus),
});
export type UpdateReservationStatusDto = z.infer<typeof updateReservationStatusSchema>;
