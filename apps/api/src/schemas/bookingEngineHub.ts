import { z } from "zod";

// Both optional and provided together or not at all — "all time" (no filter)
// is the default when omitted, since a fresh Booking Engine has very little
// history and a "last 30 days" default would often render empty.
export const bookingEngineInsightsSchema = z
  .object({
    startDate: z.string().date().optional(),
    endDate:   z.string().date().optional(),
  })
  .refine((d) => !!d.startDate === !!d.endDate, {
    message: "startDate and endDate must be provided together",
    path: ["endDate"],
  });
export type BookingEngineInsightsQuery = z.infer<typeof bookingEngineInsightsSchema>;
