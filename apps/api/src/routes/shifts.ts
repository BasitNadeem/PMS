import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { tenantMiddleware } from "../middleware/tenant";
import { ShiftService } from "../services/ShiftService";
import {
  briefingQuerySchema,
  createShiftReportSchema,
  listShiftsSchema,
  prefillQuerySchema,
  signOffSchema,
} from "../schemas/shifts";

const router: Router = Router();
router.use(authenticate, tenantMiddleware);

router.get("/prefill", async (req, res) => {
  const query = prefillQuerySchema.parse(req.query);
  const data = await ShiftService.getPrefillData(req.withTenant, query.date, query.shiftType);
  res.json({ data });
});

router.get("/handover-briefing", async (req, res) => {
  const query = briefingQuerySchema.parse(req.query);
  const data = await ShiftService.getHandoverBriefing(req.withTenant, req.user!.hotelId, query.date);
  res.json({ data });
});

router.get("/discrepancy-count", async (req, res) => {
  const count = await ShiftService.getDiscrepancyAlertCount(req.withTenant, req.user!.hotelId);
  res.json({ data: { count } });
});

router.get("/", async (req, res) => {
  const query = listShiftsSchema.parse(req.query);
  const result = await ShiftService.list(req.withTenant, req.user!.hotelId, query);
  res.json(result);
});

router.get("/:id", async (req, res) => {
  const data = await ShiftService.getOne(req.withTenant, req.user!.hotelId, req.params.id as string);
  res.json({ data });
});

router.post("/", async (req, res) => {
  const dto = createShiftReportSchema.parse(req.body);
  const data = await ShiftService.createShiftReport(req.withTenant, req.user!.hotelId, dto, req.user!.userId);
  res.status(201).json({ data });
});

router.patch("/:id/acknowledge", async (req, res) => {
  await ShiftService.acknowledgeDiscrepancy(req.withTenant, req.user!.hotelId, req.params.id as string);
  res.json({ data: { acknowledged: true } });
});

router.patch("/:id/signoff", async (req, res) => {
  const dto = signOffSchema.parse(req.body);
  const data = await ShiftService.signOff(req.withTenant, req.user!.hotelId, req.params.id as string, dto, req.user!.userId);
  res.json({ data });
});

export default router;
