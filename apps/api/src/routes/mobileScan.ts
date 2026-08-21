// Mobile scan route — no JWT auth.
// The short-lived Redis token (created by an authenticated desktop user) is the credential.
// Mounted at /api/m so it sits outside the standard authenticated inventory router.

import { Router, json } from "express";
import { scanInventorySchema } from "../schemas/inventoryScan";
import { captureGuestDocumentSchema } from "../schemas/guestDocuments";
import { InventoryScanService } from "../services/InventoryScanService";
import { GuestDocumentService } from "../services/GuestDocumentService";
import { ScanSessionService } from "../services/ScanSessionService";
import { publicWithTenant } from "../lib/publicTenant";
import { AppError } from "../utils/AppError";
import { ZodError } from "zod";

const router: Router = Router();

// POST /api/m/scan/:token
// Mobile device sends base64 image; result is pushed to desktop via SSE.
router.post(
  "/scan/:token",
  json({ limit: "5mb" }),
  async (req, res) => {
    const token   = req.params.token as string;
    const session = await ScanSessionService.get(token);

    if (!session) {
      res.status(410).json({ error: "This QR code has expired. Ask your colleague to generate a new one." });
      return;
    }
    if (session.status === "done") {
      res.status(409).json({ error: "This QR session was already used. Generate a new one." });
      return;
    }
    if (session.purpose !== "INVENTORY") {
      res.status(403).json({ error: "This QR code is not for stock scanning." });
      return;
    }

    try {
      const dto    = scanInventorySchema.parse(req.body);
      const result = await InventoryScanService.scanForSession(session.hotelId, dto);
      await ScanSessionService.complete(token, result);
      res.json({ data: { success: true, matchCount: result.matches.length } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Scan failed";
      await ScanSessionService.fail(token, msg).catch(() => {});
      res.status(500).json({ error: msg });
    }
  },
);

// POST /api/m/id/:token
// Phone sends both sides of a guest ID as base64. Same trust model as the stock
// scanner above: the short-lived token minted by an authenticated desktop user
// is the credential, and it carries the reservation this capture belongs to, so
// a leaked token cannot be aimed at a different stay.
router.post(
  "/id/:token",
  json({ limit: "10mb" }),
  async (req, res) => {
    const token   = req.params.token as string;
    const session = await ScanSessionService.get(token);

    if (!session) {
      res.status(410).json({ error: "This QR code has expired. Ask the front desk for a new one." });
      return;
    }
    if (session.status === "done") {
      res.status(409).json({ error: "This QR code was already used. Ask for a new one." });
      return;
    }
    if (session.purpose !== "GUEST_ID" || !session.context) {
      res.status(403).json({ error: "This QR code is not for ID capture." });
      return;
    }

    try {
      const dto = captureGuestDocumentSchema.parse(req.body);
      const result = await GuestDocumentService.capture(publicWithTenant(session.hotelId), {
        hotelId:       session.hotelId,
        reservationId: session.context.reservationId,
        guestId:       session.context.guestId,
        capturedBy:    session.context.userId,
        type:          dto.documentType,
        front: { base64: dto.front.imageBase64, mimeType: dto.front.mimeType },
        back:  { base64: dto.back.imageBase64,  mimeType: dto.back.mimeType  },
      });
      await ScanSessionService.complete(token, result);
      res.status(201).json({ data: { success: true } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Capture failed";
      await ScanSessionService.fail(token, msg).catch(() => {});
      // Preserve the real status. Unconfigured storage (503) and a rejected
      // payload (400) are both things the person holding the phone can act on;
      // flattening them to 500 tells them only that something broke.
      const status =
        err instanceof AppError ? err.statusCode :
        err instanceof ZodError ? 400 :
        500;
      res.status(status).json({ error: msg });
    }
  },
);

export default router;
