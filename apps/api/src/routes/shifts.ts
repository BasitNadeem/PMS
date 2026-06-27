import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { tenantMiddleware } from "../middleware/tenant";
import { ShiftService } from "../services/ShiftService";
import {
  createShiftReportSchema,
  signOffSchema,
  listShiftsSchema,
  prefillQuerySchema,
} from "../schemas/shifts";

const router = Router();
router.use(authenticate, tenantMiddleware);

router.get("/prefill", async (req, res) => {
  const query = prefillQuerySchema.parse(req.query);
  const data = await ShiftService.getPrefillData(req.withTenant, query.date, query.shiftType);
  res.json({ data });
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

router.patch("/:id/signoff", async (req, res) => {
  const dto = signOffSchema.parse(req.body);
  const data = await ShiftService.signOff(req.withTenant, req.user!.hotelId, req.params.id as string, dto, req.user!.userId);
  res.json({ data });
});

export default router;
