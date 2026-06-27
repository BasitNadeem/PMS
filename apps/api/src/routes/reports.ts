import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import { tenantMiddleware } from "../middleware/tenant";
import { ReportService } from "../services/ReportService";

const router = Router();
router.use(authenticate, tenantMiddleware);

// ── GET /api/reports/daily?date=YYYY-MM-DD ────────────────────────────────────

router.get("/daily", async (req, res) => {
  const { date } = z.object({ date: z.string().date() }).parse(req.query);
  const data = await ReportService.getDailyReport(req.withTenant, req.user!.hotelId, date);
  res.json({ data });
});

// ── GET /api/reports/monthly?year=2026&month=6 ────────────────────────────────

router.get("/monthly", async (req, res) => {
  const { year, month } = z.object({
    year: z.coerce.number().int().min(2000).max(2100),
    month: z.coerce.number().int().min(1).max(12),
  }).parse(req.query);

  const data = await ReportService.getMonthlyReport(req.withTenant, req.user!.hotelId, year, month);
  res.json({ data });
});

export default router;
