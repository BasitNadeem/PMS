import { z } from "zod";
import { FolioItemType, PaymentMethod } from "@pms/db";

export const addFolioItemSchema = z.object({
  description: z.string().trim().min(1, "Description is required"),
  type:        z.nativeEnum(FolioItemType),
  unitAmount:  z.number().int().positive("Unit amount must be a positive integer in paisas"),
  quantity:    z.number().int().min(1).default(1),
  notes:       z.string().trim().optional(),
});
export type AddFolioItemDto = z.infer<typeof addFolioItemSchema>;

export const addPaymentSchema = z.object({
  amount:         z.number().int().positive("Amount must be a positive integer in paisas"),
  method:         z.nativeEnum(PaymentMethod),
  transactionRef: z.string().trim().optional(),
  notes:          z.string().trim().optional(),
});
export type AddPaymentDto = z.infer<typeof addPaymentSchema>;

export const refundPaymentSchema = z.object({
  amount: z.number().int().positive("Refund amount must be positive"),
  reason: z.string().trim().min(3, "Refund reason is required").max(500),
});
export type RefundPaymentDto = z.infer<typeof refundPaymentSchema>;

export const billingListSchema = z.object({
  page:         z.coerce.number().int().min(1).default(1),
  limit:        z.coerce.number().int().min(1).max(100).default(20),
  statusFilter: z.enum(["open", "settled", "all"]).default("open"),
  sortBy:       z.enum(["checkOut", "balance", "guestName"]).default("checkOut"),
  sortDir:      z.enum(["asc", "desc"]).default("asc"),
});
export type BillingListQuery = z.infer<typeof billingListSchema>;
