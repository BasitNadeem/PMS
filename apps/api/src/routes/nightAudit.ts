import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import { tenantMiddleware } from "../middleware/tenant";
import { requirePermission } from "../middleware/permission";
import { NightAuditService } from "../services/NightAuditService";
import { checkFeatureAccess } from "../lib/subscription";

const router: Router = Router();
router.use(authenticate, tenantMiddleware);
router.use(async (req, _res, next) => {
  await checkFeatureAccess(req.user!.hotelId, "nightAudit");
  next();
});

// GET /api/night-audit/business-date
router.get("/business-date", requirePermission("nightAudit:read"), async (req, res) => {
  const data = await NightAuditService.getBusinessDateContext(
    req.withTenant,
    req.user!.hotelId,
  );
  res.json({ data });
});

// GET /api/night-audit/preflight?date=YYYY-MM-DD
router.get("/preflight", requirePermission("nightAudit:read"), async (req, res) => {
  const { date } = z.object({ date: z.string().date() }).parse(req.query);
  const data = await NightAuditService.getPreflightCheck(req.withTenant, req.user!.hotelId, date);
  res.json({ data });
});

// POST /api/night-audit/no-show/:reservationId
router.post("/no-show/:reservationId", requirePermission("nightAudit:markNoShow"), async (req, res) => {
  const { reservationId } = z.object({ reservationId: z.string().uuid() }).parse(req.params);
  await NightAuditService.convertToNoShow(
    req.withTenant,
    req.user!.hotelId,
    reservationId,
    req.user!.userId,
  );
  res.json({ data: { success: true } });
});

// POST /api/night-audit/run
router.post("/run", requirePermission("nightAudit:run"), async (req, res) => {
  const { businessDate, skippedNoShowIds, exceptionReason } = z.object({
    businessDate: z.string().date(),
    skippedNoShowIds: z.array(z.string().uuid()).default([]),
    exceptionReason: z.string().trim().max(1000).optional(),
  }).parse(req.body);
  const data = await NightAuditService.runNightAudit(
    req.withTenant,
    req.user!.hotelId,
    businessDate,
    req.user!.userId,
    { skippedNoShowIds, exceptionReason },
  );
  res.status(201).json({ data });
});

// GET /api/night-audit/history
router.get("/history", requirePermission("nightAudit:read"), async (req, res) => {
  const { page, limit } = z.object({
    page:  z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }).parse(req.query);
  const result = await NightAuditService.listAuditRecords(req.withTenant, req.user!.hotelId, { page, limit });
  res.json(result);
});

// GET /api/night-audit/:id
router.get("/:id", requirePermission("nightAudit:read"), async (req, res) => {
  const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
  const data = await NightAuditService.getAuditRecordDetail(req.withTenant, req.user!.hotelId, id);
  res.json({ data });
});

export default router;
