import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import { tenantMiddleware } from "../middleware/tenant";
import { requirePermission } from "../middleware/permission";
import { NightAuditService } from "../services/NightAuditService";

const router: Router = Router();
router.use(authenticate, tenantMiddleware);

// GET /api/night-audit/business-date
router.get("/business-date", requirePermission("reports:read"), async (req, res) => {
  const businessDate = await NightAuditService.getBusinessDate(req.withTenant);
  res.json({ data: { businessDate } });
});

// GET /api/night-audit/preflight?date=YYYY-MM-DD
router.get("/preflight", requirePermission("reports:read"), async (req, res) => {
  const { date } = z.object({ date: z.string().date() }).parse(req.query);
  const data = await NightAuditService.getPreflightCheck(req.withTenant, req.user!.hotelId, date);
  res.json({ data });
});

// POST /api/night-audit/no-show/:reservationId
router.post("/no-show/:reservationId", requirePermission("settings:update"), async (req, res) => {
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
router.post("/run", requirePermission("settings:update"), async (req, res) => {
  const { businessDate } = z.object({ businessDate: z.string().date() }).parse(req.body);
  const data = await NightAuditService.runNightAudit(
    req.withTenant,
    req.user!.hotelId,
    businessDate,
    req.user!.userId,
  );
  res.status(201).json({ data });
});

// GET /api/night-audit/history
router.get("/history", requirePermission("reports:read"), async (req, res) => {
  const { page, limit } = z.object({
    page:  z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }).parse(req.query);
  const result = await NightAuditService.listAuditRecords(req.withTenant, { page, limit });
  res.json(result);
});

// GET /api/night-audit/:id
router.get("/:id", requirePermission("reports:read"), async (req, res) => {
  const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
  const data = await NightAuditService.getAuditRecordDetail(req.withTenant, id);
  res.json({ data });
});

export default router;
