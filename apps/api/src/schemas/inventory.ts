import { z } from "zod";

export const listInventorySchema = z.object({
  category:     z.string().trim().optional(),
  search:       z.string().trim().optional(),
  lowStockOnly: z.coerce.boolean().optional(),
  page:         z.coerce.number().int().min(1).default(1),
  limit:        z.coerce.number().int().min(1).max(500).default(50),
});

const inventoryItemFields = z.object({
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

// Reorder level triggers the low-stock alert; par level is the top-up target.
// Suggested order qty is (par - current), so reorder above par would flag an
// item as low with nothing to order.
export const REORDER_ABOVE_PAR = "Reorder level cannot be higher than par level";

export const createInventoryItemSchema = inventoryItemFields.refine(
  (v) => v.reorderLevel <= v.parLevel,
  { message: REORDER_ABOVE_PAR, path: ["reorderLevel"] },
);

// A partial update may send either field alone, so the resulting pair is
// re-checked against the stored row in InventoryService.updateItem.
export const updateInventoryItemSchema = inventoryItemFields
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
