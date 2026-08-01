import { Router } from "express";
import { adminPrisma } from "@pms/db";
import { authenticate } from "../middleware/auth";
import { env } from "../lib/env";
import { subscribePushSchema, unsubscribePushSchema } from "../schemas/push";
import { checkFeatureAccess } from "../lib/subscription";

const router: Router = Router();

// GET /api/push/vapid-public-key — no auth, the public key is safe to expose
router.get("/vapid-public-key", (_req, res) => {
  res.json({ publicKey: env.VAPID_PUBLIC_KEY });
});

router.use(authenticate);

// POST /api/push/subscribe
router.post("/subscribe", async (req, res) => {
  await checkFeatureAccess(req.user!.hotelId, "housekeepingPWA");
  const body = subscribePushSchema.parse(req.body);

  await adminPrisma.pushSubscription.upsert({
    where: { endpoint: body.endpoint },
    create: {
      hotelId:  req.user!.hotelId,
      userId:   req.user!.userId,
      endpoint: body.endpoint,
      p256dh:   body.p256dh,
      auth:     body.auth,
    },
    update: {
      hotelId: req.user!.hotelId,
      userId:  req.user!.userId,
      p256dh:  body.p256dh,
      auth:    body.auth,
    },
  });

  res.json({ success: true });
});

// DELETE /api/push/subscribe
router.delete("/subscribe", async (req, res) => {
  const body = unsubscribePushSchema.parse(req.body);

  await adminPrisma.pushSubscription.deleteMany({
    where: { endpoint: body.endpoint, userId: req.user!.userId },
  });

  res.json({ success: true });
});

export default router;
