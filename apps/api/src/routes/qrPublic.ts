/**
 * Public QR-menu routes — no authentication required.
 * Mounted at /api/qr-public in index.ts.
 *
 * These three endpoints are the only surface exposed to guests' phones.
 * They resolve hotel context from the URL slug (never from a JWT).
 */

import { Router } from "express";
import { adminPrisma } from "@pms/db";
import { verifyRoomQuerySchema, placeOrderSchema } from "../schemas/qrMenu";
import { QrMenuService } from "../services/QrMenuService";
import { QrOrderService } from "../services/QrOrderService";
import { getEffectiveLimits } from "../lib/subscription";

const router: Router = Router();

// ── Shared: resolve hotel from slug ───────────────────────────────────────────

async function resolveHotel(slug: string) {
  return adminPrisma.hotel.findUnique({
    where:  { slug },
    select: { id: true, name: true, isActive: true, settings: true },
  });
}

function getPosTaxRate(settings: unknown): number {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return 0;
  const rate = (settings as Record<string, unknown>).posTaxRate;
  return typeof rate === "number" && Number.isFinite(rate)
    ? Math.max(0, Math.min(100, rate))
    : 0;
}

async function qrOrderingIsAvailable(hotelId: string): Promise<boolean> {
  const { features } = await getEffectiveLimits(hotelId);
  return features.qrOrdering;
}

// GET /api/qr-public/:hotelSlug/menu
// Returns all available categories + items for the guest menu.
// Respects availability flags and time windows.
router.get("/:hotelSlug/menu", async (req, res) => {
  const hotel = await resolveHotel(req.params.hotelSlug as string);
  if (!hotel?.isActive || !(await qrOrderingIsAvailable(hotel.id))) {
    res.status(404).json({ error: "Hotel not found" });
    return;
  }
  const categories = await QrMenuService.getPublicMenu(hotel.id);
  res.json({
    data: categories,
    hotel: { name: hotel.name, posTaxRate: getPosTaxRate(hotel.settings) },
  });
});

// GET /api/qr-public/:hotelSlug/verify-room?q=204
// Checks whether a room number has an active checked-in reservation.
// Returns { found, roomNumber, guestName, guestPhone } when matched — used to
// autofill the guest details form, so this endpoint does expose guest PII.
router.get("/:hotelSlug/verify-room", async (req, res) => {
  const hotel = await resolveHotel(req.params.hotelSlug as string);
  if (!hotel?.isActive || !(await qrOrderingIsAvailable(hotel.id))) {
    res.status(404).json({ error: "Hotel not found" });
    return;
  }
  const { q }  = verifyRoomQuerySchema.parse(req.query);
  const result = await QrOrderService.verifyRoom(hotel.id, q);
  res.json({ data: result });
});

// POST /api/qr-public/:hotelSlug/order
// Places a guest order. Auto-posts to room folio if room is verified (try/catch,
// folio failure never blocks order). Returns order number + estimated wait.
router.post("/:hotelSlug/order", async (req, res) => {
  const hotel = await resolveHotel(req.params.hotelSlug as string);
  if (!hotel?.isActive || !(await qrOrderingIsAvailable(hotel.id))) {
    res.status(404).json({ error: "Hotel not found" });
    return;
  }
  const dto    = placeOrderSchema.parse(req.body);
  const result = await QrOrderService.createOrder(hotel.id, dto);
  res.status(201).json({ data: result });
});

// GET /api/qr-public/:hotelSlug/track?orderNumber=ORD-0012
// Public order tracking — returns status and items. No PII exposed.
router.get("/:hotelSlug/track", async (req, res) => {
  const hotel = await resolveHotel(req.params.hotelSlug as string);
  if (!hotel?.isActive || !(await qrOrderingIsAvailable(hotel.id))) {
    res.status(404).json({ error: "Hotel not found" });
    return;
  }
  const orderNumber = (req.query.orderNumber as string | undefined)?.trim().toUpperCase();
  if (!orderNumber) {
    res.status(400).json({ error: "orderNumber is required" });
    return;
  }
  const result = await QrOrderService.trackOrder(hotel.id, orderNumber);
  if (!result) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  res.json({ data: result });
});

export default router;
