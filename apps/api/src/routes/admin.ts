import { Router } from "express";
import rateLimit from "express-rate-limit";
import { adminAuth } from "../middleware/adminAuth";
import { adminLoginSchema, createHotelSchema, updateHotelSchema } from "../schemas/admin";
import { AdminService } from "../services/AdminService";

const router = Router();

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

export default router;
