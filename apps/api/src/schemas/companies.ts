import { z } from "zod";
import { CompanyType, CompanyPaymentTerms, PaymentMethod } from "@pms/db";
import { optionalPhoneSchema, optionalEmailSchema } from "../lib/validation";

// Money arrives from the client in rupees and is stored in paisa, matching the
// rest of the app. Two decimal places max — there is no sub-paisa amount.
const rupeesToPaisa = z.coerce
  .number()
  .min(0)
  .max(100_000_000)
  .transform((v) => Math.round(v * 100));

export const listCompaniesSchema = z.object({
  search:      z.string().trim().optional(),
  type:        z.nativeEnum(CompanyType).optional(),
  isActive:    z.coerce.boolean().optional(),
  /// Only companies carrying an unpaid balance.
  withBalance: z.coerce.boolean().optional(),
  /// Only companies with at least one charge past its due date.
  overdue:     z.coerce.boolean().optional(),
  sort:        z.enum(["name", "balance", "createdAt"]).default("name"),
  page:        z.coerce.number().int().min(1).default(1),
  limit:       z.coerce.number().int().min(1).max(100).default(20),
});
export type ListCompaniesQuery = z.infer<typeof listCompaniesSchema>;

const companyFields = {
  name:         z.string().trim().min(1).max(160),
  type:         z.nativeEnum(CompanyType).default("TOUR_AGENCY"),
  code:         z.string().trim().max(30).optional(),
  contactName:  z.string().trim().max(120).optional(),
  contactPhone: optionalPhoneSchema,
  contactEmail: optionalEmailSchema,
  address:      z.string().trim().max(400).optional(),
  city:         z.string().trim().max(80).optional(),
  // Pakistani tax identifiers. Optional — most small agencies are unregistered,
  // and refusing to save the company over a missing NTN would be worse than
  // printing an invoice without one.
  ntn:          z.string().trim().max(20).optional(),
  strn:         z.string().trim().max(20).optional(),
  paymentTerms: z.nativeEnum(CompanyPaymentTerms).default("NET_30"),
  // Negotiated rate defaults. Both optional; the booking screen pre-fills from
  // whichever is set and the user can still override per booking.
  ratePlanId:      z.string().uuid().nullish(),
  discountPercent: z.coerce.number().int().min(0).max(90).nullish(),
  notes:        z.string().trim().max(2000).optional(),
};

export const createCompanySchema = z.object({
  ...companyFields,
  // Deliberately absent from this schema: creditLimit. A company is always
  // created with zero credit and a limit must be set separately by someone
  // holding COMPANY_CREDIT_LIMIT, so creating a company can never itself be
  // the act of lending money.
});
export type CreateCompanyDto = z.infer<typeof createCompanySchema>;

export const updateCompanySchema = z.object({
  ...companyFields,
  name:         companyFields.name.optional(),
  type:         z.nativeEnum(CompanyType).optional(),
  paymentTerms: z.nativeEnum(CompanyPaymentTerms).optional(),
  isActive:     z.boolean().optional(),
}).partial();
export type UpdateCompanyDto = z.infer<typeof updateCompanySchema>;

export const setCreditLimitSchema = z.object({
  creditLimit: rupeesToPaisa,
  reason:      z.string().trim().max(300).optional(),
});
export type SetCreditLimitDto = z.infer<typeof setCreditLimitSchema>;

export const companyLedgerQuerySchema = z.object({
  /// "open" hides fully settled charges — the default view when chasing money.
  status: z.enum(["all", "open", "settled"]).default("all"),
  from:   z.string().date().optional(),
  to:     z.string().date().optional(),
  page:   z.coerce.number().int().min(1).default(1),
  limit:  z.coerce.number().int().min(1).max(200).default(50),
});
export type CompanyLedgerQuery = z.infer<typeof companyLedgerQuerySchema>;

export const companyProductionQuerySchema = z.object({
  from: z.string().date(),
  to: z.string().date(),
}).refine((value) => value.from <= value.to, { path: ["to"], message: "End date must be on or after start date" });
export type CompanyProductionQuery = z.infer<typeof companyProductionQuerySchema>;

export const recordCompanyPaymentSchema = z.object({
  amount:    rupeesToPaisa.refine((v) => v > 0, "Amount must be greater than zero"),
  method:    z.nativeEnum(PaymentMethod).default("BANK_TRANSFER"),
  reference: z.string().trim().max(120).optional(),
  paidAt:    z.string().date().optional(),
  notes:     z.string().trim().max(300).optional(),
  idempotencyKey: z.string().uuid(),
});
export type RecordCompanyPaymentDto = z.infer<typeof recordCompanyPaymentSchema>;

export const adjustCompanyLedgerSchema = z.object({
  // ADJUSTMENT adds to what the company owes (a late fee, a correction);
  // WRITE_OFF reduces it (bad debt, a goodwill discount). Both need a reason —
  // an unexplained movement on a receivable is exactly what an audit flags.
  type:        z.enum(["ADJUSTMENT", "WRITE_OFF"]),
  amount:      rupeesToPaisa.refine((v) => v > 0, "Amount must be greater than zero"),
  description: z.string().trim().min(3).max(300),
  entryDate:   z.string().date().optional(),
});
export type AdjustCompanyLedgerDto = z.infer<typeof adjustCompanyLedgerSchema>;

export const transferFolioSchema = z.object({
  companyId: z.string().uuid(),
  /// Optional partial transfer. Omitted means the whole outstanding balance.
  amount:    rupeesToPaisa.optional(),
  note:      z.string().trim().max(300).optional(),
  idempotencyKey: z.string().min(8).max(120),
});
export type TransferFolioDto = z.infer<typeof transferFolioSchema>;

export const createCompanyInvoiceSchema = z.object({
  periodStart: z.string().date(),
  periodEnd:   z.string().date(),
  notes:       z.string().trim().max(1000).optional(),
  /// Issue immediately rather than leaving it as a draft.
  issue:       z.boolean().default(false),
}).refine((d) => d.periodStart <= d.periodEnd, {
  message: "The period start must be on or before the period end",
  path:    ["periodEnd"],
});
export type CreateCompanyInvoiceDto = z.infer<typeof createCompanyInvoiceSchema>;

export const reverseCompanyPaymentSchema = z.object({
  reason: z.string().trim().min(3).max(300),
});
export type ReverseCompanyPaymentDto = z.infer<typeof reverseCompanyPaymentSchema>;

export const reverseFolioTransferSchema = z.object({
  reason: z.string().trim().min(5, "Enter a clear reason for reversing the BTC transfer").max(300),
  payerAction: z.enum(["KEEP_COMPANY", "RETURN_TO_GUEST"]).default("KEEP_COMPANY"),
});
export type ReverseFolioTransferDto = z.infer<typeof reverseFolioTransferSchema>;

export const refundCompanyCreditSchema = z.object({
  amount:    rupeesToPaisa.refine((v) => v > 0, "Amount must be greater than zero"),
  method:    z.nativeEnum(PaymentMethod),
  reference: z.string().trim().max(120).optional(),
  reason:    z.string().trim().min(3).max(300),
  paidAt:    z.string().date().optional(),
  idempotencyKey: z.string().uuid(),
});
export type RefundCompanyCreditDto = z.infer<typeof refundCompanyCreditSchema>;

export const voidCompanyInvoiceSchema = z.object({
  reason: z.string().trim().min(3).max(300),
});

export const agingReportSchema = z.object({
  asOf: z.string().date().optional(),
  /// Hide companies whose balance is zero.
  onlyOutstanding: z.coerce.boolean().default(true),
});
export type AgingReportQuery = z.infer<typeof agingReportSchema>;
