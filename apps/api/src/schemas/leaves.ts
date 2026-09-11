import { z } from "zod";

const dateSchema = z.string().date();

export const listLeavesSchema = z.object({
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).superRefine((value, context) => {
  if (value.startDate && value.endDate && value.startDate > value.endDate) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["endDate"], message: "End date must be on or after start date" });
  }
});

export const createLeaveSchema = z.object({
  userId: z.string().uuid(),
  startDate: dateSchema,
  endDate: dateSchema,
  notes: z.string().trim().max(500).optional(),
}).superRefine((value, context) => {
  if (value.startDate > value.endDate) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["endDate"], message: "End date must be on or after start date" });
    return;
  }
  const days = Math.floor((Date.parse(`${value.endDate}T00:00:00.000Z`) - Date.parse(`${value.startDate}T00:00:00.000Z`)) / 86_400_000) + 1;
  if (days > 366) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["endDate"], message: "A leave entry can cover at most 366 days" });
  }
});

export const leaveIdSchema = z.string().uuid();

export type CreateLeaveDto = z.infer<typeof createLeaveSchema>;
