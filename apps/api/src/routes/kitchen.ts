import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { tenantMiddleware } from "../middleware/tenant";
import { requirePermission } from "../middleware/permission";
import { QrOrderService } from "../services/QrOrderService";
import { checkFeatureAccess } from "../lib/subscription";

const router: Router = Router();
router.use(authenticate, tenantMiddleware);
router.use(async (req, _res, next) => {
  await checkFeatureAccess(req.user!.hotelId, "kitchenDisplay");
  next();
});

// GET /api/kitchen/orders — active orders only (excludes delivered + cancelled)
// Used by the kitchen display, polled every 8 seconds.
// Uses pos:read so KITCHEN role (which has pos:read) can access without pos:manage.
router.get("/orders", requirePermission("pos:read"), async (req, res) => {
  const orders = await QrOrderService.getKitchenOrders(req.user!.hotelId);
  res.json({ data: orders });
});

export default router;
