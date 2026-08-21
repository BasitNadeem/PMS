import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { tenantMiddleware } from "../middleware/tenant";
import { requirePermission } from "../middleware/permission";
import {
  listRatePlansSchema,
  createRatePlanSchema,
  updateRatePlanSchema,
  suggestRateSchema,
  createRatePlanCodeSchema,
  updateRatePlanCodeSchema,
} from "../schemas/ratePlans";
import { RatePlanService } from "../services/RatePlanService";
import { checkFeatureAccess } from "../lib/subscription";
import { queueChannexSync } from "../lib/channexSync";

const router: Router = Router();

router.use(authenticate, tenantMiddleware);

// GET /api/rate-plans/suggest — price lookup only, gated on RESERVATION_READ (not RATE_READ)
// FRONT_DESK needs this to see rate suggestions when creating reservations.
// Must be registered BEFORE /:id so Express doesn't treat "suggest" as a UUID.
router.get("/suggest", requirePermission("RESERVATION_READ"), async (req, res) => {
  const query = suggestRateSchema.parse(req.query);
  const result = await RatePlanService.suggestRate(req.withTenant, query, req.user!.hotelId);
  res.json({ data: result });
});

// GET /api/rate-plans
router.get("/", requirePermission("RATE_READ"), async (req, res) => {
  const query = listRatePlansSchema.parse(req.query);
  const result = await RatePlanService.listRatePlans(req.withTenant, query);
  res.json(result);
});

// GET /api/rate-plans/:id
router.get("/:id", requirePermission("RATE_READ"), async (req, res) => {
  const plan = await RatePlanService.getRatePlan(req.withTenant, req.params.id as string);
  res.json({ data: plan });
});

// POST /api/rate-plans — ratePlans feature gate required
router.post("/", requirePermission("RATE_CREATE"), async (req, res) => {
  await checkFeatureAccess(req.user!.hotelId, "ratePlans");
  const body = createRatePlanSchema.parse(req.body);
  const plan = await RatePlanService.createRatePlan(
    req.withTenant,
    req.user!.hotelId,
    body,
    req.user!
  );
  // Rate plan structure changed — republish the whole horizon. Only pairs
  // carrying a channex_rate_plan_id are actually pushed, so a brand-new
  // unprovisioned plan is a cheap no-op rather than a leak.
  queueChannexSync({ hotelId: req.user!.hotelId, reason: "RATE_PLAN_CHANGE" });
  res.status(201).json({ data: plan });
});

// PATCH /api/rate-plans/:id — ratePlans feature gate required
router.patch("/:id", requirePermission("RATE_UPDATE"), async (req, res) => {
  await checkFeatureAccess(req.user!.hotelId, "ratePlans");
  const body = updateRatePlanSchema.parse(req.body);
  const plan = await RatePlanService.updateRatePlan(
    req.withTenant,
    req.user!.hotelId,
    req.params.id as string,
    body,
    req.user!
  );
  queueChannexSync({ hotelId: req.user!.hotelId, reason: "RATE_PLAN_CHANGE" });
  res.json({ data: plan });
});

// PATCH /api/rate-plans/:id/activate — re-activates a deactivated plan
router.patch("/:id/activate", requirePermission("RATE_UPDATE"), async (req, res) => {
  await checkFeatureAccess(req.user!.hotelId, "ratePlans");
  await RatePlanService.activateRatePlan(
    req.withTenant,
    req.user!.hotelId,
    req.params.id as string,
    req.user!
  );
  queueChannexSync({ hotelId: req.user!.hotelId, reason: "RATE_PLAN_CHANGE" });
  res.status(204).send();
});

// POST /api/rate-plans/:id/codes — public Booking Engine promo/corporate access code
router.post("/:id/codes", requirePermission("RATE_UPDATE"), async (req, res) => {
  await checkFeatureAccess(req.user!.hotelId, "ratePlans");
  const body = createRatePlanCodeSchema.parse(req.body);
  const code = await RatePlanService.createRatePlanCode(req.withTenant, req.user!.hotelId, req.params.id as string, body, req.user!);
  res.status(201).json({ data: code });
});

// PATCH /api/rate-plans/:id/codes/:codeId
router.patch("/:id/codes/:codeId", requirePermission("RATE_UPDATE"), async (req, res) => {
  await checkFeatureAccess(req.user!.hotelId, "ratePlans");
  const body = updateRatePlanCodeSchema.parse(req.body);
  const code = await RatePlanService.updateRatePlanCode(
    req.withTenant,
    req.user!.hotelId,
    req.params.id as string,
    req.params.codeId as string,
    body,
    req.user!,
  );
  res.json({ data: code });
});

// DELETE /api/rate-plans/:id/codes/:codeId — soft-deactivates code history
router.delete("/:id/codes/:codeId", requirePermission("RATE_UPDATE"), async (req, res) => {
  await checkFeatureAccess(req.user!.hotelId, "ratePlans");
  await RatePlanService.deactivateRatePlanCode(
    req.withTenant,
    req.user!.hotelId,
    req.params.id as string,
    req.params.codeId as string,
    req.user!,
  );
  res.status(204).send();
});

// DELETE /api/rate-plans/:id — soft-deactivates; ratePlans feature gate required
router.delete("/:id", requirePermission("RATE_DELETE"), async (req, res) => {
  await checkFeatureAccess(req.user!.hotelId, "ratePlans");
  await RatePlanService.deactivateRatePlan(
    req.withTenant,
    req.user!.hotelId,
    req.params.id as string,
    req.user!
  );
  queueChannexSync({ hotelId: req.user!.hotelId, reason: "RATE_PLAN_CHANGE" });
  res.status(204).send();
});

export default router;
