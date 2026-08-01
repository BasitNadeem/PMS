import { z } from "zod";

export const ACCOUNT_SCOPES = [
  "FOLIO_ITEM_TYPE", "TAX_TYPE", "PAYMENT_METHOD", "EXPENSE_CATEGORY", "SYSTEM",
] as const;

export const EXPORT_FORMATS = ["GENERIC_CSV", "TALLY_XML"] as const;

export const exportQuerySchema = z.object({
  from: z.string().date(),
  to:   z.string().date(),
  format: z.enum(EXPORT_FORMATS).default("GENERIC_CSV"),
  // Accountants overwhelmingly prefer one line per account per day to hundreds
  // of individual postings, so the summary is the default.
  granularity: z.enum(["DAILY_SUMMARY", "TRANSACTION"]).default("DAILY_SUMMARY"),
}).refine((d) => d.to >= d.from, {
  message: "End date must not be before the start date",
  path:    ["to"],
}).refine((d) => {
  const days = (new Date(d.to).getTime() - new Date(d.from).getTime()) / 86_400_000;
  return days <= 366;
}, {
  message: "Export at most one year at a time",
  path:    ["to"],
});
export type ExportQuery = z.infer<typeof exportQuerySchema>;

export const updateMappingsSchema = z.object({
  mappings: z.array(z.object({
    scope:       z.enum(ACCOUNT_SCOPES),
    key:         z.string().trim().min(1).max(60),
    accountCode: z.string().trim().min(1).max(30),
    accountName: z.string().trim().min(1).max(120),
  })).min(1).max(300),
});
export type UpdateMappingsDto = z.infer<typeof updateMappingsSchema>;
