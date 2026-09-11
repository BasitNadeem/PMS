import { z } from "zod";

// ── Categories ────────────────────────────────────────────────────────────────
// A category (and item, below) is shared between the POS terminal and the
// guest QR menu. isActive/isAvailable gate POS visibility; isQrVisible gates
// the QR menu — independently, so either channel can hide something without
// touching the other.

const timeOfDay = z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM format").nullable().optional();

export const createCategorySchema = z.object({
  name:           z.string().trim().min(1, "Name is required"),
  sortOrder:      z.number().int().min(0).default(0),
  isQrVisible:    z.boolean().default(true),
  availableFrom:  timeOfDay,
  availableUntil: timeOfDay,
});
export type CreateCategoryDto = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = z.object({
  name:           z.string().trim().min(1).optional(),
  sortOrder:      z.number().int().min(0).optional(),
  isActive:       z.boolean().optional(),
  isQrVisible:    z.boolean().optional(),
  availableFrom:  timeOfDay,
  availableUntil: timeOfDay,
});
export type UpdateCategoryDto = z.infer<typeof updateCategorySchema>;

// ── Items ─────────────────────────────────────────────────────────────────────

// One line of a menu item's recipe. A menu item carries zero or more; zero
// means it is not stock-tracked. Sending `ingredients` replaces the whole set.
export const recipeIngredientSchema = z.object({
  inventoryItemId: z.string().uuid(),
  qtyUsed:         z.coerce.number().positive("Quantity used must be greater than zero"),
});
export type RecipeIngredientDto = z.infer<typeof recipeIngredientSchema>;

// Mirrors the @@unique([posItemId, inventoryItemId]) constraint so a repeated
// ingredient comes back as a 400 rather than a Prisma P2002.
const ingredientList = z
  .array(recipeIngredientSchema)
  .max(50, "A recipe cannot have more than 50 ingredients")
  .refine(
    (lines) => new Set(lines.map((l) => l.inventoryItemId)).size === lines.length,
    { message: "Each inventory item can only appear once in a recipe" },
  );

export const createItemSchema = z.object({
  name:             z.string().trim().min(1, "Name is required"),
  description:      z.string().trim().optional(),
  price:            z.number().int().positive("Price must be positive (in paisas)"),
  categoryId:       z.string().uuid(),
  isAvailable:      z.boolean().default(true),
  sortOrder:        z.number().int().min(0).default(0),
  ingredients:      ingredientList.default([]),
  photoUrl:         z.string().url("Must be a valid URL").nullable().optional(),
  isQrVisible:      z.boolean().default(true),
  isFeatured:       z.boolean().default(false),
  taxRate:          z.coerce.number().min(0).max(1).default(0),
});
export type CreateItemDto = z.infer<typeof createItemSchema>;

export const updateItemSchema = z.object({
  name:              z.string().trim().min(1).optional(),
  description:       z.string().trim().nullable().optional(),
  price:             z.number().int().positive().optional(),
  isAvailable:       z.boolean().optional(),
  sortOrder:         z.number().int().min(0).optional(),
  ingredients:       ingredientList.optional(),
  photoUrl:          z.string().url("Must be a valid URL").nullable().optional(),
  isQrVisible:       z.boolean().optional(),
  isFeatured:        z.boolean().optional(),
  taxRate:           z.coerce.number().min(0).max(1).optional(),
});
export type UpdateItemDto = z.infer<typeof updateItemSchema>;

// ── Orders ────────────────────────────────────────────────────────────────────

export const createOrderSchema = z
  .object({
    items: z
      .array(
        z.object({
          posItemId: z.string().uuid(),
          quantity:  z.number().int().min(1),
        }),
      )
      .min(1, "At least one item is required"),
    settlementType: z.enum(["FOLIO", "DIRECT"]),
    reservationId:  z.string().uuid().optional(),
    paymentMethod:  z.enum(["CASH", "JAZZCASH", "EASYPAISA", "CREDIT_CARD", "DEBIT_CARD"]).optional(),
    notes:          z.string().trim().optional(),
  })
  .refine(
    (d) => d.settlementType !== "FOLIO" || d.reservationId !== undefined,
    { message: "reservationId is required for FOLIO settlement", path: ["reservationId"] },
  )
  .refine(
    (d) => d.settlementType !== "DIRECT" || d.paymentMethod !== undefined,
    { message: "paymentMethod is required for DIRECT settlement", path: ["paymentMethod"] },
  );
export type CreateOrderDto = z.infer<typeof createOrderSchema>;

export const updateOrderStatusSchema = z.object({
  status: z.literal("CANCELLED"),
});
export type UpdateOrderStatusDto = z.infer<typeof updateOrderStatusSchema>;

export const listOrdersSchema = z.object({
  status: z.enum(["OPEN", "POSTED_TO_FOLIO", "PAID", "CANCELLED"]).optional(),
  page:   z.coerce.number().int().min(1).default(1),
  limit:  z.coerce.number().int().min(1).max(100).default(20),
});
export type ListOrdersQuery = z.infer<typeof listOrdersSchema>;
