import { z } from "zod";

export const listInventorySchema = z.object({
  category:     z.string().trim().optional(),
  search:       z.string().trim().optional(),
  lowStockOnly: z.coerce.boolean().optional(),
  page:         z.coerce.number().int().min(1).default(1),
  limit:        z.coerce.number().int().min(1).max(500).default(50),
});

export const createInventoryItemSchema = z.object({
  name:         z.string().trim().min(1),
  category:     z.string().trim().min(1),
  unit:         z.string().trim().min(1),
  parLevel:     z.coerce.number().min(0).default(0),
  reorderLevel: z.coerce.number().min(0).default(0),
  costPerUnit:  z.coerce.number().min(0).default(0), // PKR — converted to paisas in service
  supplier:     z.string().trim().optional(),
  openingStock: z.coerce.number().min(0).default(0),
  sku:          z.string().trim().optional(),
});

export const updateInventoryItemSchema = createInventoryItemSchema
  .omit({ openingStock: true })
  .partial();

export const createTransactionSchema = z.object({
  type:          z.enum(["PURCHASE", "CONSUMPTION", "WASTE", "ADJUSTMENT"]),
  quantity:      z.coerce.number().positive(),
  unitCost:      z.coerce.number().min(0).optional(), // PKR — converted in service
  notes:         z.string().trim().optional(),
  referenceId:   z.string().trim().optional(),
  referenceType: z.string().trim().optional(),
});

export type ListInventoryQuery     = z.infer<typeof listInventorySchema>;
export type CreateInventoryItemDto = z.infer<typeof createInventoryItemSchema>;
export type UpdateInventoryItemDto = z.infer<typeof updateInventoryItemSchema>;
export type CreateTransactionDto   = z.infer<typeof createTransactionSchema>;
