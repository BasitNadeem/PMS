import { z } from "zod";

// ── Public guest endpoints ────────────────────────────────────────────────────

export const verifyRoomQuerySchema = z.object({
  q: z.string().trim().min(1, "Room number is required"),
});
export type VerifyRoomQuery = z.infer<typeof verifyRoomQuerySchema>;

export const placeOrderSchema = z.object({
  guestName:           z.string().trim().min(1, "Guest name is required"),
  guestPhone:          z.string().trim().min(7, "Phone number is required"),
  roomNumber:          z.string().trim().min(1, "Room number is required"),
  deliveryType:        z.enum(["room_delivery", "pickup", "dine_in"]),
  paymentPreference:   z.enum(["charge_to_room", "pay_now"]).default("charge_to_room"),
  specialInstructions: z.string().trim().optional(),
  items: z
    .array(
      z.object({
        menuItemId:  z.string().uuid("Invalid menu item ID"),
        quantity:    z.number().int().positive("Quantity must be at least 1"),
        specialNote: z.string().trim().optional(),
      }),
    )
    .min(1, "At least one item is required"),
});
export type PlaceOrderDto = z.infer<typeof placeOrderSchema>;

// Menu category/item management lives in schemas/pos.ts — the QR menu and the
// POS menu are the same data (PosCategory/PosItem), managed from one screen.

// ── Staff: QR order management ────────────────────────────────────────────────

export const listQrOrdersSchema = z.object({
  status:    z
    .enum(["pending", "confirmed", "preparing", "ready", "delivered", "cancelled"])
    .optional(),
  startDate: z.string().date().optional(),
  endDate:   z.string().date().optional(),
  page:      z.coerce.number().int().min(1).default(1),
  limit:     z.coerce.number().int().min(1).max(100).default(20),
});
export type ListQrOrdersQuery = z.infer<typeof listQrOrdersSchema>;

export const advanceStatusSchema = z.object({
  status: z.enum(["confirmed", "preparing", "ready", "delivered", "cancelled"]),
});
export type AdvanceStatusDto = z.infer<typeof advanceStatusSchema>;

export const editOrderSchema = z.object({
  deliveryType:        z.enum(["room_delivery", "pickup", "dine_in"]).optional(),
  specialInstructions: z.string().trim().optional().nullable(),
  items: z
    .array(
      z.object({
        menuItemId:  z.string().uuid("Invalid menu item ID"),
        quantity:    z.number().int().positive("Quantity must be at least 1"),
        specialNote: z.string().trim().optional(),
      }),
    )
    .min(1, "At least one item is required")
    .optional(),
});
export type EditOrderDto = z.infer<typeof editOrderSchema>;
