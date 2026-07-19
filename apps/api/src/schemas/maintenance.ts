import { z } from "zod";

const STATUS_VALUES = ["OPEN", "IN_PROGRESS", "AWAITING_PARTS", "RESOLVED", "CLOSED"] as const;
export type MaintenanceTicketStatus = (typeof STATUS_VALUES)[number];

const PRIORITY_VALUES = ["URGENT", "HIGH", "MEDIUM", "LOW"] as const;
export type MaintenanceTicketPriority = (typeof PRIORITY_VALUES)[number];

const CATEGORY_VALUES = [
  "ELECTRICAL",
  "PLUMBING",
  "HVAC",
  "FURNITURE",
  "ELECTRONICS",
  "STRUCTURAL",
  "OTHER",
] as const;
export type MaintenanceCategory = (typeof CATEGORY_VALUES)[number];

export const listTicketsSchema = z.object({
  status:       z.enum(STATUS_VALUES).optional(),
  priority:     z.enum(PRIORITY_VALUES).optional(),
  category:     z.enum(CATEGORY_VALUES).optional(),
  roomId:       z.string().uuid().optional(),
  assignedToId: z.string().uuid().optional(),
  page:         z.coerce.number().int().min(1).default(1),
  limit:        z.coerce.number().int().min(1).max(100).default(50),
});
export type ListTicketsQuery = z.infer<typeof listTicketsSchema>;

export const createTicketSchema = z.object({
  roomId:          z.string().uuid().optional(),
  title:           z.string().trim().min(1, "Title is required"),
  description:     z.string().trim().optional(),
  category:        z.enum(CATEGORY_VALUES),
  priority:        z.enum(PRIORITY_VALUES).default("MEDIUM"),
  assignedToId:    z.string().uuid().optional(),
  scheduledFor:    z.string().datetime().optional(),
  scheduledEndDate: z.string().date().optional(),
  photoUrls:       z.array(z.string().min(1)).optional(),
});
export type CreateTicketDto = z.infer<typeof createTicketSchema>;

export const updateTicketSchema = z.object({
  assignedToId:    z.string().uuid().nullable().optional(),
  priority:        z.enum(PRIORITY_VALUES).optional(),
  category:        z.enum(CATEGORY_VALUES).optional(),
  title:           z.string().trim().min(1).optional(),
  description:     z.string().trim().nullable().optional(),
  scheduledFor:    z.string().datetime().nullable().optional(),
  scheduledEndDate: z.string().date().nullable().optional(),
  estimatedCost:   z.number().int().nonnegative().nullable().optional(),
  actualCost:      z.number().int().nonnegative().nullable().optional(),
});
export type UpdateTicketDto = z.infer<typeof updateTicketSchema>;

export const updateTicketStatusSchema = z.object({
  status:          z.enum(STATUS_VALUES),
  resolutionNotes: z.string().trim().optional(),
}).refine(
  (d) => d.status !== "RESOLVED" || !!d.resolutionNotes,
  { message: "Resolution notes are required when resolving a ticket", path: ["resolutionNotes"] },
);
export type UpdateTicketStatusDto = z.infer<typeof updateTicketStatusSchema>;
