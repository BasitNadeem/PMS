import { z } from "zod";
import { DocumentType, SpecialDateKind, PromoIssueReason } from "@pms/db";
import { phoneSchema, optionalPhoneSchema, optionalEmailSchema } from "../lib/validation";

// Days in each month, using 29 for February so a 29 Feb birthday can be stored.
// Non-leap years are handled when the occasion is celebrated, not when it is
// recorded — refusing to save a real birthday would be the worse failure.
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export const specialDateSchema = z.object({
  kind:  z.nativeEnum(SpecialDateKind).default("BIRTHDAY"),
  label: z.string().trim().max(60).optional(),
  month: z.coerce.number().int().min(1).max(12),
  day:   z.coerce.number().int().min(1).max(31),
  // Optional on purpose: guests often give a day and month but withhold the
  // year. Storing a made-up year would let an age be computed from it.
  year:  z.coerce.number().int().min(1900).max(new Date().getFullYear()).optional(),
  source: z.string().trim().max(30).optional(),
}).refine((d) => d.day <= DAYS_IN_MONTH[d.month - 1]!, {
  message: "That day does not exist in the selected month",
  path:    ["day"],
});
export type SpecialDateDto = z.infer<typeof specialDateSchema>;

export const listOccasionsSchema = z.object({
  // How far ahead to look. Defaults to a week so the front desk can prepare.
  withinDays: z.coerce.number().int().min(0).max(90).default(7),
});
export type ListOccasionsQuery = z.infer<typeof listOccasionsSchema>;

export const issuePromoCodeSchema = z.object({
  reason:      z.nativeEnum(PromoIssueReason).default("MANUAL"),
  discountPercent: z.coerce.number().int().min(1).max(90),
  /// How long the guest has to use it. A deadline is what makes an offer act.
  validForDays: z.coerce.number().int().min(1).max(365).default(30),
  label:       z.string().trim().max(60).optional(),
  sendEmail:   z.boolean().default(true),
  // Manual, one-message exception only. This never changes the guest's saved
  // marketing preference and automated occasion emails must not use it.
  overrideMarketingConsent: z.boolean().default(false),
}).refine((d) => !d.overrideMarketingConsent || d.sendEmail, {
  message: "A consent override can only be used when sending the offer email",
  path: ["overrideMarketingConsent"],
});
export type IssuePromoCodeDto = z.infer<typeof issuePromoCodeSchema>;

// Comma-separated in the query string ("?tags=Corporate,Repeat"), so accept the
// raw string and split it rather than relying on Express array parsing.
const tagFilterSchema = z
  .union([z.string(), z.array(z.string())])
  .transform((v) => (Array.isArray(v) ? v : v.split(",")))
  .transform((v) => v.map((t) => t.trim()).filter(Boolean))
  .optional();

export const listGuestsSchema = z.object({
  search:      z.string().trim().optional(),
  blacklisted: z.coerce.boolean().optional(),
  tags:        tagFilterSchema,
  minVipLevel: z.coerce.number().int().min(0).max(3).optional(),
  page:        z.coerce.number().int().min(1).default(1),
  limit:       z.coerce.number().int().min(1).max(100).default(20),
});
export type ListGuestsQuery = z.infer<typeof listGuestsSchema>;

export const createGuestSchema = z.object({
  firstName:      z.string().trim().min(1),
  lastName:       z.string().trim().min(1),
  email:          optionalEmailSchema,
  phone:          phoneSchema,
  alternatePhone: optionalPhoneSchema,
  nationality:    z.string().trim().optional(),
  gender:         z.string().trim().optional(),
  dateOfBirth:    z.string().date().optional(),
  documentType:   z.nativeEnum(DocumentType).default("CNIC"),
  documentNumber: z.string().trim().min(1),
  // Rendered on the guest profile and used for the expiry warning at check-in,
  // but it was missing from this schema so nothing could ever save it.
  documentExpiry: z.string().date().optional(),
  address:        z.string().trim().optional(),
  city:           z.string().trim().optional(),
  country:        z.string().trim().optional(),
  language:       z.string().trim().optional(),
  internalNotes:  z.string().trim().optional(),
  vipLevel:       z.number().int().min(0).max(3).optional(),
  // Free-form labels the front desk applies for segmentation (Corporate,
  // Repeat, Long-stay…). Normalised and de-duplicated so casing differences do
  // not create parallel tags.
  tags:           z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  // Consent to receive greetings and offers. Separate from holding a birthday,
  // which is often captured off an identity document for compliance.
  marketingOptIn: z.boolean().optional(),
  // True once the guest has been asked for a birthday/anniversary and declined,
  // so the front desk stops asking on every visit.
  specialDatesDeclined: z.boolean().optional(),
  specialDates:   z.array(specialDateSchema).max(10).optional(),
  // Set after the caller has seen the duplicate-guest warning and chosen to
  // proceed anyway (e.g. a couple genuinely sharing one phone number).
  allowDuplicate: z.boolean().optional(),
});
export type CreateGuestDto = z.infer<typeof createGuestSchema>;

export const updateGuestSchema = createGuestSchema.partial();
export type UpdateGuestDto = z.infer<typeof updateGuestSchema>;


export const blacklistGuestSchema = z.object({
  reason: z.string().trim().min(1),
  severity: z.enum(["LOW", "MEDIUM", "HIGH"]),
  documentNumber: z.string().trim().optional(),
});
export type BlacklistGuestDto = z.infer<typeof blacklistGuestSchema>;

export const checkBlacklistSchema = z.object({
  documentNumber: z.string().trim().optional(),
  phone: optionalPhoneSchema,
  email: optionalEmailSchema,
}).refine((d) => d.documentNumber || d.phone || d.email, {
  message: "At least one of documentNumber, phone, or email is required",
});
export type CheckBlacklistDto = z.infer<typeof checkBlacklistSchema>;
