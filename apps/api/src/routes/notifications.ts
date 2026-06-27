import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import { tenantMiddleware } from "../middleware/tenant";
import { NotificationService } from "../services/NotificationService";

const router = Router();
router.use(authenticate, tenantMiddleware);

// GET /api/notifications/count — BEFORE /:id
router.get("/count", async (req, res) => {
  const count = await NotificationService.getUnreadCount(
    req.withTenant,
    req.user!.userId,
  );
  res.json({ data: { count } });
});

// GET /api/notifications/all — BEFORE /:id
router.get("/all", async (req, res) => {
  const { page, limit } = z.object({
    page:  z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }).parse(req.query);

  const result = await NotificationService.listAllNotifications(
    req.withTenant,
    req.user!.userId,
    page,
    limit,
  );
  res.json(result);
});

// GET /api/notifications
router.get("/", async (req, res) => {
  const notifications = await NotificationService.listNotifications(
    req.withTenant,
    req.user!.userId,
  );
  res.json({ data: notifications });
});

// PATCH /api/notifications/read-all — BEFORE /:id
router.patch("/read-all", async (req, res) => {
  await NotificationService.markAllAsRead(req.withTenant, req.user!.userId);
  res.json({ data: { ok: true } });
});

// PATCH /api/notifications/:id/read
router.patch("/:id/read", async (req, res) => {
  const notification = await NotificationService.markAsRead(
    req.withTenant,
    req.params.id as string,
  );
  res.json({ data: notification });
});

export default router;
