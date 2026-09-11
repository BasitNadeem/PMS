import { z } from "zod";

export const attendanceStatusSchema = z.enum(["PRESENT", "ABSENT", "LEAVE", "HALF_DAY"]);

export const listAttendanceSchema = z.object({
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const markAttendanceSchema = z.object({
  userId: z.string().uuid(),
  attendanceDate: z.string().date(),
  status: attendanceStatusSchema,
  notes: z.string().trim().max(500).optional(),
});

export type MarkAttendanceDto = z.infer<typeof markAttendanceSchema>;
