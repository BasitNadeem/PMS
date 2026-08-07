import { z } from "zod";
import { FolioItemType, UpsellPriceType } from "@pms/db";

export const listUpsellItemsSchema = z.object({
  isActive: z
    .string()
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  page:  z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type ListUpsellItemsQuery = z.infer<typeof listUpsellItemsSchema>;

export const createUpsellItemSchema = z.object({
  name:        z.string().trim().min(1, "Name is required").max(100),
  description: z.string().trim().max(500).optional(),
  category:    z.nativeEnum(FolioItemType).default("MISCELLANEOUS"),
  priceType:   z.nativeEnum(UpsellPriceType).default("FLAT"),
  amount:      z.number().int().positive("Price must be greater than zero"),
  imageUrl:    z.string().trim().url().optional(),
});
export type CreateUpsellItemDto = z.infer<typeof createUpsellItemSchema>;

export const updateUpsellItemSchema = z.object({
  name:        z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  category:    z.nativeEnum(FolioItemType).optional(),
  priceType:   z.nativeEnum(UpsellPriceType).optional(),
  amount:      z.number().int().positive().optional(),
  imageUrl:    z.string().trim().url().nullable().optional(),
  isActive:    z.boolean().optional(),
});
export type UpdateUpsellItemDto = z.infer<typeof updateUpsellItemSchema>;
