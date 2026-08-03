import { z } from "zod";

export const ACCOUNT_TYPES = [
  "CASH_DRAWER", "BANK_ACCOUNT", "JAZZCASH", "EASYPAISA", "PETTY_CASH", "OTHER",
] as const;
export type AccountType = typeof ACCOUNT_TYPES[number];

export const ENTRY_TYPES  = ["INCOMING", "OUTGOING"] as const;
export const SOURCE_TYPES = [
  "FOLIO_PAYMENT", "PAYMENT_REFUND", "EXPENSE", "POS_SALE", "QR_ORDER_SALE", "ACCOUNT_TRANSFER",
  "COMPANY_PAYMENT", "COMPANY_CREDIT_REFUND",
  "BANK_DEPOSIT", "CASH_WITHDRAWAL",
  "OPENING_BALANCE", "ADJUSTMENT", "OTHER",
] as const;

export const createAccountSchema = z.object({
  name:        z.string().trim().min(1),
  accountType: z.enum(ACCOUNT_TYPES),
});
export type CreateAccountDto = z.infer<typeof createAccountSchema>;

export const openingBalanceSchema = z.object({
  amount: z.number().int().positive(),
});
export type OpeningBalanceDto = z.infer<typeof openingBalanceSchema>;

export const createEntrySchema = z.object({
  accountId:     z.string().uuid(),
  entryType:     z.enum(ENTRY_TYPES),
  amount:        z.number().int().positive(),
  description:   z.string().trim().min(1),
  sourceType:    z.enum(SOURCE_TYPES).default("OTHER"),
  notes:         z.string().trim().optional(),
  entryDate:     z.string().date().optional(),
  paymentMethod: z.string().trim().optional(),
});
export type CreateEntryDto = z.infer<typeof createEntrySchema>;

export const transferSchema = z.object({
  fromAccountId: z.string().uuid(),
  toAccountId:   z.string().uuid(),
  amount:        z.number().int().positive(),
  description:   z.string().trim().min(1).max(300),
  entryDate:     z.string().date().optional(),
  notes:         z.string().trim().max(1000).optional(),
}).refine((value) => value.fromAccountId !== value.toAccountId, {
  message: "Source and destination accounts must be different",
  path: ["toAccountId"],
});
export type TransferDto = z.infer<typeof transferSchema>;

export const ledgerQuerySchema = z.object({
  accountId:  z.string().uuid().optional(),
  startDate:  z.string().date().optional(),
  endDate:    z.string().date().optional(),
  entryType:  z.enum(ENTRY_TYPES).optional(),
  sourceType: z.enum(SOURCE_TYPES).optional(),
  page:       z.coerce.number().int().min(1).default(1),
  limit:      z.coerce.number().int().min(1).max(100).default(25),
});
export type LedgerQuery = z.infer<typeof ledgerQuerySchema>;

export const summaryQuerySchema = z.object({
  startDate: z.string().date().optional(),
  endDate:   z.string().date().optional(),
});
export type SummaryQuery = z.infer<typeof summaryQuerySchema>;

export const balancesQuerySchema = z.object({
  asOf: z.string().date().optional(),
});
export type BalancesQuery = z.infer<typeof balancesQuerySchema>;
