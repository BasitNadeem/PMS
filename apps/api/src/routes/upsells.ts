import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { tenantMiddleware } from "../middleware/tenant";
import { requirePermission } from "../middleware/permission";
import {
  listUpsellItemsSchema,
  createUpsellItemSchema,
  updateUpsellItemSchema,
} from "../schemas/upsells";
import { UpsellService } from "../services/UpsellService";
import { checkFeatureAccess } from "../lib/subscription";

const router: Router = Router();

router.use(authenticate, tenantMiddleware);

// GET /api/upsells
router.get("/", requirePermission("UPSELL_READ"), async (req, res) => {
  const query = listUpsellItemsSchema.parse(req.query);
  const result = await UpsellService.listUpsellItems(req.withTenant, query);
  res.json(result);
});

// POST /api/upsells
router.post("/", requirePermission("UPSELL_CREATE"), async (req, res) => {
  await checkFeatureAccess(req.user!.hotelId, "bookingEngine");
  const body = createUpsellItemSchema.parse(req.body);
  const item = await UpsellService.createUpsellItem(
    req.withTenant,
    req.user!.hotelId,
    body,
    req.user!
  );
  res.status(201).json({ data: item });
});

// PATCH /api/upsells/:id
router.patch("/:id", requirePermission("UPSELL_UPDATE"), async (req, res) => {
  await checkFeatureAccess(req.user!.hotelId, "bookingEngine");
  const body = updateUpsellItemSchema.parse(req.body);
  const item = await UpsellService.updateUpsellItem(
    req.withTenant,
    req.user!.hotelId,
    req.params.id as string,
    body,
    req.user!
  );
  res.json({ data: item });
});

// DELETE /api/upsells/:id — soft-deactivates
router.delete("/:id", requirePermission("UPSELL_DELETE"), async (req, res) => {
  await UpsellService.deactivateUpsellItem(
    req.withTenant,
    req.user!.hotelId,
    req.params.id as string,
    req.user!
  );
  res.status(204).send();
});

export default router;
