import { z } from "zod";

const PRIORITY_VALUES = ["URGENT", "HIGH", "NORMAL", "LOW"] as const;
export type HousekeepingPriority = (typeof PRIORITY_VALUES)[number];

const TASK_TYPE_VALUES = [
  "CHECKOUT_CLEAN",
  "ROUTINE_CLEAN",
  "TURNDOWN",
  "MAINTENANCE_CLEAN",
  "INSPECTION",
] as const;
export type HousekeepingTaskType = (typeof TASK_TYPE_VALUES)[number];

const STATUS_VALUES = ["PENDING", "IN_PROGRESS", "COMPLETED"] as const;

export const listTasksSchema = z.object({
  status:       z.enum(STATUS_VALUES).optional(),
  priority:     z.enum(PRIORITY_VALUES).optional(),
  roomId:       z.string().uuid().optional(),
  assignedToId: z.string().uuid().optional(),
  page:         z.coerce.number().int().min(1).default(1),
  limit:        z.coerce.number().int().min(1).max(100).default(50),
});
export type ListTasksQuery = z.infer<typeof listTasksSchema>;

export const createTaskSchema = z.object({
  roomId:        z.string().uuid(),
  taskType:      z.enum(TASK_TYPE_VALUES),
  priority:      z.enum(PRIORITY_VALUES).default("NORMAL"),
  assignedToId:  z.string().uuid().optional(),
  scheduledDate: z.string().date().optional(),
  notes:         z.string().trim().optional(),
});
export type CreateTaskDto = z.infer<typeof createTaskSchema>;

export const updateTaskSchema = z.object({
  assignedToId:  z.string().uuid().nullable().optional(),
  priority:      z.enum(PRIORITY_VALUES).optional(),
  notes:         z.string().trim().nullable().optional(),
  scheduledDate: z.string().date().optional(),
});
export type UpdateTaskDto = z.infer<typeof updateTaskSchema>;

export const updateTaskStatusSchema = z.object({
  status: z.enum(STATUS_VALUES),
});
export type UpdateTaskStatusDto = z.infer<typeof updateTaskStatusSchema>;
