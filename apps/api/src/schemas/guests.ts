import { z } from "zod";
import { DocumentType } from "@pms/db";

export const listGuestsSchema = z.object({
  search:      z.string().trim().optional(),
  blacklisted: z.coerce.boolean().optional(),
  page:        z.coerce.number().int().min(1).default(1),
  limit:       z.coerce.number().int().min(1).max(100).default(20),
});
export type ListGuestsQuery = z.infer<typeof listGuestsSchema>;

export const createGuestSchema = z.object({
  firstName:      z.string().trim().min(1),
  lastName:       z.string().trim().min(1),
  email:          z.string().trim().email().optional().or(z.literal("")),
  phone:          z.string().trim().min(1),
  alternatePhone: z.string().trim().optional(),
  nationality:    z.string().trim().optional(),
  gender:         z.string().trim().optional(),
  dateOfBirth:    z.string().date().optional(),
  documentType:   z.nativeEnum(DocumentType).default("CNIC"),
  documentNumber: z.string().trim().min(1),
  address:        z.string().trim().optional(),
  city:           z.string().trim().optional(),
  country:        z.string().trim().optional(),
  internalNotes:  z.string().trim().optional(),
  vipLevel:       z.number().int().min(0).max(3).optional(),
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
  phone: z.string().trim().optional(),
  email: z.string().trim().optional(),
}).refine((d) => d.documentNumber || d.phone || d.email, {
  message: "At least one of documentNumber, phone, or email is required",
});
export type CheckBlacklistDto = z.infer<typeof checkBlacklistSchema>;
