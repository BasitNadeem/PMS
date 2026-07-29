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
import { requirePermission } from "../middleware/permission";

const router: Router = Router();
router.use(authenticate, tenantMiddleware);

router.get("/context", requirePermission("shiftHandover:read"), async (req, res) => {
  const data = await ShiftService.getCurrentContext(req.withTenant, req.user!.hotelId);
  res.json({ data });
});

router.get("/prefill", requirePermission("shiftHandover:read"), async (req, res) => {
  const query = prefillQuerySchema.parse(req.query);
  const data = await ShiftService.getPrefillData(req.withTenant, req.user!.hotelId, query.date, query.shiftType);
  res.json({ data });
});

router.get("/handover-briefing", requirePermission("shiftHandover:read"), async (req, res) => {
  const query = briefingQuerySchema.parse(req.query);
  const data = await ShiftService.getHandoverBriefing(req.withTenant, req.user!.hotelId, query.date, query.shiftType);
  res.json({ data });
});

router.get("/discrepancy-count", requirePermission("shiftHandover:read"), async (req, res) => {
  const count = await ShiftService.getDiscrepancyAlertCount(req.withTenant, req.user!.hotelId);
  res.json({ data: { count } });
});

router.get("/", requirePermission("shiftHandover:read"), async (req, res) => {
  const query = listShiftsSchema.parse(req.query);
  const result = await ShiftService.list(req.withTenant, req.user!.hotelId, query);
  res.json(result);
});

router.get("/:id", requirePermission("shiftHandover:read"), async (req, res) => {
  const data = await ShiftService.getOne(req.withTenant, req.user!.hotelId, req.params.id as string);
  res.json({ data });
});

router.post("/", requirePermission("shiftHandover:submit"), async (req, res) => {
  const dto = createShiftReportSchema.parse(req.body);
  const data = await ShiftService.createShiftReport(req.withTenant, req.user!.hotelId, dto, req.user!.userId);
  res.status(201).json({ data });
});

router.patch("/:id/acknowledge", requirePermission("shiftHandover:acknowledge"), async (req, res) => {
  await ShiftService.acknowledgeDiscrepancy(req.withTenant, req.user!.hotelId, req.params.id as string, req.user!.userId);
  res.json({ data: { acknowledged: true } });
});

router.patch("/:id/signoff", requirePermission("shiftHandover:signoff"), async (req, res) => {
  const dto = signOffSchema.parse(req.body);
  const data = await ShiftService.signOff(req.withTenant, req.user!.hotelId, req.params.id as string, dto, req.user!.userId);
  res.json({ data });
});

export default router;
