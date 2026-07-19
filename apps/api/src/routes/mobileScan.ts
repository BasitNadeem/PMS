// Mobile scan route — no JWT auth.
// The short-lived Redis token (created by an authenticated desktop user) is the credential.
// Mounted at /api/m so it sits outside the standard authenticated inventory router.

import { Router, json } from "express";
import { scanInventorySchema } from "../schemas/inventoryScan";
import { InventoryScanService } from "../services/InventoryScanService";
import { ScanSessionService } from "../services/ScanSessionService";

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

export default router;
