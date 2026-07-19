import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { tenantMiddleware } from "../middleware/tenant";
import { requirePermission } from "../middleware/permission";
import { billingListSchema } from "../schemas/folio";
import { FolioService } from "../services/FolioService";

const router: Router = Router();

router.use(authenticate, tenantMiddleware);

// GET /api/billing/summary
router.get("/summary", requirePermission("FOLIO_READ"), async (req, res) => {
  const result = await FolioService.summary(req.withTenant);
  res.json({ data: result });
});

// GET /api/billing/folios
router.get("/folios", requirePermission("FOLIO_READ"), async (req, res) => {
  const query  = billingListSchema.parse(req.query);
  const result = await FolioService.listForBilling(req.withTenant, query);
  res.json(result);
});

export default router;
