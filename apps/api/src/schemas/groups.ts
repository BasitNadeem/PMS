import { z } from "zod";
import { DocumentType } from "@pms/db";
import { phoneSchema, optionalPhoneSchema } from "../lib/validation";

export const PAYER_TYPES = ["TOUR_AGENCY", "CORPORATE", "GOVERNMENT", "NGO", "INDIVIDUAL"] as const;
export const payerTypeSchema = z.enum(PAYER_TYPES);
export type PayerType = z.infer<typeof payerTypeSchema>;

export const BILLING_TYPES = ["SINGLE", "SPLIT"] as const;
export const billingTypeSchema = z.enum(BILLING_TYPES);
export type BillingType = z.infer<typeof billingTypeSchema>;

export const PAYMENT_TERMS = ["ADVANCE_50", "ADVANCE_100", "ADVANCE_CUSTOM", "CREDIT_30", "CREDIT_60", "CASH"] as const;
export const paymentTermsSchema = z.enum(PAYMENT_TERMS);
export type PaymentTerms = z.infer<typeof paymentTermsSchema>;

export const GROUP_STATUSES = ["ENQUIRY", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "CANCELLED"] as const;
export const groupStatusSchema = z.enum(GROUP_STATUSES);
export type GroupStatus = z.infer<typeof groupStatusSchema>;

export const listGroupsSchema = z.object({
  status: groupStatusSchema.optional(),
  search: z.string().trim().optional(),
  page:   z.coerce.number().int().min(1).default(1),
  limit:  z.coerce.number().int().min(1).max(100).default(20),
});
export type ListGroupsQuery = z.infer<typeof listGroupsSchema>;

const newGuestSchema = z.object({
  firstName:      z.string().trim().min(1),
  lastName:       z.string().trim().min(1),
  phone:          phoneSchema,
  documentType:   z.nativeEnum(DocumentType).default("CNIC"),
  documentNumber: z.string().trim().min(1),
  allowDuplicate: z.boolean().optional(),
});

const leaderGuestSchema = z
  .object({
    existingGuestId: z.string().uuid().optional(),
    newGuest:        newGuestSchema.optional(),
  })
  .refine((d) => !!d.existingGuestId !== !!d.newGuest, {
    message: "Provide either existingGuestId or newGuest, not both",
  });

const groupRoomSchema = z.object({
  roomTypeId:   z.string().uuid(),
  quantity:     z.number().int().positive(),
  ratePerNight: z.number().int().positive().optional(),
});

export const createGroupSchema = z
  .object({
    name:           z.string().trim().min(1),
    groupRef:       z.string().trim().optional(),
    payerType:      payerTypeSchema,
    payerName:      z.string().trim().min(1),
    payerContact:   optionalPhoneSchema,
    billingType:    billingTypeSchema.default("SINGLE"),
    paymentTerms:   paymentTermsSchema.default("CASH"),
    advancePaid:    z.number().min(0).default(0),
    negotiatedRate: z.number().min(0).max(100).default(0),
    checkInDate:    z.string().date(),
    checkOutDate:   z.string().date(),
    totalRooms:     z.number().int().positive(),
    notes:          z.string().trim().optional(),
    rooms:          z.array(groupRoomSchema).min(1),
    leaderGuest:    leaderGuestSchema,
  })
  .refine((d) => new Date(d.checkOutDate) > new Date(d.checkInDate), {
    message: "Check-out must be after check-in",
    path: ["checkOutDate"],
  });
export type CreateGroupDto = z.infer<typeof createGroupSchema>;

export const updateGroupSchema = z.object({
  name:           z.string().trim().min(1).optional(),
  payerType:      payerTypeSchema.optional(),
  payerName:      z.string().trim().min(1).optional(),
  payerContact:   optionalPhoneSchema,
  billingType:    billingTypeSchema.optional(),
  paymentTerms:   paymentTermsSchema.optional(),
  advancePaid:    z.number().min(0).optional(),
  negotiatedRate: z.number().min(0).max(100).optional(),
  checkInDate:    z.string().date().optional(),
  checkOutDate:   z.string().date().optional(),
  totalRooms:     z.number().int().positive().optional(),
  notes:          z.string().trim().optional(),
});
export type UpdateGroupDto = z.infer<typeof updateGroupSchema>;

export const updateGroupStatusSchema = z.object({
  status: groupStatusSchema,
});
export type UpdateGroupStatusDto = z.infer<typeof updateGroupStatusSchema>;

export const addRoomToGroupSchema = z.object({
  roomId:       z.string().uuid().optional(),
  roomTypeId:   z.string().uuid(),
  ratePerNight: z.number().int().positive(),
});
export type AddRoomToGroupDto = z.infer<typeof addRoomToGroupSchema>;

export const addGuestToGroupSchema = z.object({
  guestId:        z.string().uuid(),
  isLeader:       z.boolean().default(false),
  roomPreference: z.string().trim().optional(),
});
export type AddGuestToGroupDto = z.infer<typeof addGuestToGroupSchema>;

export const assignRoomSchema = z.object({
  roomId: z.string().uuid(),
});
export type AssignRoomDto = z.infer<typeof assignRoomSchema>;
