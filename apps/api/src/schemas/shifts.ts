import { z } from "zod";

export const createShiftReportSchema = z.object({
  shiftDate:      z.string().date(),
  shiftType:      z.enum(["MORNING", "EVENING", "NIGHT"]),
  openingBalance: z.number().int().min(0),
  cashCollected:  z.number().int().min(0),
  cashExpenses:   z.number().int().min(0),
  checkIns:       z.number().int().min(0),
  checkOuts:      z.number().int().min(0),
  newBookings:    z.number().int().min(0),
  posOrders:      z.number().int().min(0),
  notes:          z.string().trim().optional(),
});
export type CreateShiftReportDto = z.infer<typeof createShiftReportSchema>;

export const signOffSchema = z.object({
  actualCashCount: z.number().int().min(0),
  notes:           z.string().trim().optional(),
});
export type SignOffDto = z.infer<typeof signOffSchema>;

export const listShiftsSchema = z.object({
  startDate: z.string().date().optional(),
  endDate:   z.string().date().optional(),
  shiftType: z.enum(["MORNING", "EVENING", "NIGHT"]).optional(),
  page:      z.coerce.number().int().min(1).default(1),
  limit:     z.coerce.number().int().min(1).max(100).default(20),
});
export type ListShiftsQuery = z.infer<typeof listShiftsSchema>;

export const prefillQuerySchema = z.object({
  date:      z.string().date(),
  shiftType: z.enum(["MORNING", "EVENING", "NIGHT"]),
});
export type PrefillQuery = z.infer<typeof prefillQuerySchema>;
