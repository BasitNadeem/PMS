import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { tenantMiddleware } from "../middleware/tenant";
import { requirePermission } from "../middleware/permission";
import { GuestService } from "../services/GuestService";
import { GuestOccasionService } from "../services/GuestOccasionService";
import {
  listGuestsSchema, createGuestSchema, updateGuestSchema, blacklistGuestSchema, checkBlacklistSchema,
  listOccasionsSchema, issuePromoCodeSchema,
} from "../schemas/guests";

const router: Router = Router();
import { GuestDocumentService } from "../services/GuestDocumentService";

router.use(authenticate, tenantMiddleware);

router.get("/", requirePermission("GUEST_READ"), async (req, res) => {
  const query = listGuestsSchema.parse(req.query);
  const result = await GuestService.listGuests(req.withTenant, query);
  res.json(result);
});


router.post("/check-blacklist", requirePermission("GUEST_READ"), async (req, res) => {
  const dto = checkBlacklistSchema.parse(req.body);
  const result = await GuestService.checkBlacklist(req.withTenant, dto);
  res.json({ data: result });
});

router.post("/:id/blacklist", requirePermission("GUEST_UPDATE"), async (req, res) => {
  const dto = blacklistGuestSchema.parse(req.body);
  const guest = await GuestService.blacklistGuest(req.withTenant, req.user!.hotelId, req.params.id as string, dto, req.user!.userId);
  res.json({ data: guest });
});

router.delete("/:id/blacklist", requirePermission("GUEST_UPDATE"), async (req, res) => {
  const guest = await GuestService.removeFromBlacklist(req.withTenant, req.user!.hotelId, req.params.id as string, req.user!.userId);
  res.json({ data: guest });
});

// Must stay above "/:id" so these are not parsed as guest ids.
router.get("/tags", requirePermission("GUEST_READ"), async (req, res) => {
  const tags = await GuestService.listTags(req.withTenant);
  res.json({ data: tags });
});

router.get("/occasions", requirePermission("GUEST_READ"), async (req, res) => {
  const query  = listOccasionsSchema.parse(req.query);
  const result = await GuestOccasionService.listUpcoming(req.withTenant, query);
  res.json(result);
});

router.get("/:id/promo-codes", requirePermission("GUEST_READ"), async (req, res) => {
  const codes = await GuestOccasionService.listGuestPromoCodes(req.withTenant, req.params.id as string);
  res.json({ data: codes });
});

router.post("/:id/promo-codes", requirePermission("GUEST_UPDATE"), async (req, res) => {
  const dto    = issuePromoCodeSchema.parse(req.body);
  const code = await GuestOccasionService.issuePromoCode(req.withTenant, req.user!, req.params.id as string, dto);
  res.status(201).json({ data: code });
});

router.post("/:id/promo-codes/:codeId/retry-email", requirePermission("GUEST_UPDATE"), async (req, res) => {
  const code = await GuestOccasionService.retryPromoEmail(
    req.withTenant, req.user!, req.params.id as string, req.params.codeId as string,
  );
  res.json({ data: code });
});

// GET /api/guests/:id/documents — every ID document held for this guest.
// Declared before "/:id" so Express does not match "documents" as a guest id.
router.get("/:id/documents", requirePermission("GUEST_READ"), async (req, res) => {
  const docs = await GuestDocumentService.listForGuest(req.withTenant, req.user!.hotelId, req.params.id as string);
  res.json({ data: docs });
});

// GET /api/guests/:id/documents/:documentId/image — the image bytes.
// Served through our own auth instead of a provider URL, so access follows the
// user's permissions, stays revocable, and every read is attributable.
router.get("/:id/documents/:documentId/image", requirePermission("GUEST_READ"), async (req, res) => {
  const { bytes, mimeType } = await GuestDocumentService.readImage(
    req.withTenant,
    req.user!.hotelId,
    req.params.id as string,
    req.params.documentId as string,
  );
  res.setHeader("Content-Type", mimeType);
  // A photograph of someone's CNIC must not persist in a shared browser cache
  // or an intermediary proxy after the permission that allowed it is gone.
  res.setHeader("Cache-Control", "no-store, private");
  res.send(bytes);
});

router.get("/:id", requirePermission("GUEST_READ"), async (req, res) => {
  const guest = await GuestService.getGuest(req.withTenant, req.params.id as string);
  res.json({ data: guest });
});

router.post("/", requirePermission("GUEST_CREATE"), async (req, res) => {
  const dto = createGuestSchema.parse(req.body);
  const guest = await GuestService.createGuest(req.withTenant, req.user!, dto);
  res.status(201).json({ data: guest });
});

router.patch("/:id", requirePermission("GUEST_UPDATE"), async (req, res) => {
  const dto = updateGuestSchema.parse(req.body);
  const guest = await GuestService.updateGuest(req.withTenant, req.user!, req.params.id as string, dto);
  res.json({ data: guest });
});

export default router;
