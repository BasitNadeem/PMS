import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { tenantMiddleware } from "../middleware/tenant";
import { requirePermission } from "../middleware/permission";
import { checkFeatureAccess } from "../lib/subscription";
import { bookingEngineInsightsSchema } from "../schemas/bookingEngineHub";
import { ReportService } from "../services/ReportService";

const router: Router = Router();
router.use(authenticate, tenantMiddleware);

// GET /api/booking-engine/insights?startDate=&endDate=
// Gated on the same bookingEngine feature flag as the public booking routes —
// if a hotel's plan doesn't include it, there's nothing here worth showing.
router.get("/insights", requirePermission("BOOKING_ENGINE_READ"), async (req, res) => {
  await checkFeatureAccess(req.user!.hotelId, "bookingEngine");
  const { startDate, endDate } = bookingEngineInsightsSchema.parse(req.query);
  const data = await ReportService.getBookingEngineInsights(req.withTenant, startDate, endDate);
  res.json({ data });
});

export default router;
