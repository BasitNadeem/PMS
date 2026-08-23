import { Router } from "express";
import rateLimit from "express-rate-limit";
import { adminAuth } from "../middleware/adminAuth";
import {
  adminLoginSchema,
  createHotelSchema,
  updateHotelSchema,
  createPlanSchema,
  updatePlanSchema,
  savePortfolioSchema,
} from "../schemas/admin";
import { AdminService } from "../services/AdminService";

const router: Router = Router();

// POST /api/admin/login
router.post(
  "/login",
  rateLimit({ windowMs: 15 * 60 * 1000, max: 20 }),
  async (req, res) => {
    const body = adminLoginSchema.parse(req.body);
    const result = AdminService.login(body);
    res.json(result);
  }
);

// GET /api/admin/hotels
router.get("/hotels", adminAuth, async (_req, res) => {
  const hotels = await AdminService.listHotels();
  res.json({ data: hotels });
});

// POST /api/admin/hotels
router.post("/hotels", adminAuth, async (req, res) => {
  const body = createHotelSchema.parse(req.body);
  const result = await AdminService.createHotel(body);
  res.status(201).json({ data: result });
});

// GET /api/admin/hotels/:id
router.get("/hotels/:id", adminAuth, async (req, res) => {
  const hotel = await AdminService.getHotel(req.params.id as string);
  res.json({ data: hotel });
});

// PATCH /api/admin/hotels/:id
router.patch("/hotels/:id", adminAuth, async (req, res) => {
  const body = updateHotelSchema.parse(req.body);
  const hotel = await AdminService.updateHotel(req.params.id as string, body);
  res.json({ data: hotel });
});

// POST /api/admin/hotels/:id/reset-owner-password
router.post("/hotels/:id/reset-owner-password", adminAuth, async (req, res) => {
  const result = await AdminService.resetOwnerPassword(req.params.id as string);
  res.json({ data: result });
});

router.get("/portfolios/candidates", adminAuth, async (_req, res) => {
  res.json({ data: await AdminService.listPortfolioCandidates() });
});

router.get("/portfolios", adminAuth, async (_req, res) => {
  res.json({ data: await AdminService.listPortfolios() });
});

router.post("/portfolios", adminAuth, async (req, res) => {
  const body = savePortfolioSchema.parse(req.body);
  const portfolio = await AdminService.createPortfolio(body, {
    email: req.admin!.email,
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });
  res.status(201).json({ data: portfolio });
});

router.get("/portfolios/:id", adminAuth, async (req, res) => {
  res.json({ data: await AdminService.getPortfolio(req.params.id as string) });
});

router.put("/portfolios/:id", adminAuth, async (req, res) => {
  const body = savePortfolioSchema.parse(req.body);
  const portfolio = await AdminService.updatePortfolio(req.params.id as string, body, {
    email: req.admin!.email,
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });
  res.json({ data: portfolio });
});

// GET /api/admin/plans
router.get("/plans", adminAuth, async (_req, res) => {
  const plans = await AdminService.listPlans();
  res.json({ data: plans });
});

router.get("/plans/meta", adminAuth, (_req, res) => {
  res.json({ data: AdminService.getPlanMetadata() });
});

// POST /api/admin/plans
router.post("/plans", adminAuth, async (req, res) => {
  const body = createPlanSchema.parse(req.body);
  const plan = await AdminService.createPlan(body);
  res.status(201).json({ data: plan });
});

// PATCH /api/admin/plans/:id
router.patch("/plans/:id", adminAuth, async (req, res) => {
  const body = updatePlanSchema.parse(req.body);
  const plan = await AdminService.updatePlan(req.params.id as string, body);
  res.json({ data: plan });
});

// DELETE /api/admin/plans/:id
router.delete("/plans/:id", adminAuth, async (req, res) => {
  await AdminService.deletePlan(req.params.id as string);
  res.status(204).send();
});

export default router;
