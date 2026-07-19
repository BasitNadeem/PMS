import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { tenantMiddleware } from "../middleware/tenant";

const router: Router = Router();

router.use(authenticate, tenantMiddleware);

router.get("/me", async (req, res) => {
  const hotel = await req.withTenant((db) =>
    db.hotel.findUniqueOrThrow({
      where: { id: req.user!.hotelId },
      select: {
        id: true, name: true, slug: true, propertyType: true,
        city: true, country: true, phone: true, email: true,
        isActive: true, isTrialAccount: true, trialEndsAt: true,
        settings: true,
      },
    })
  );
  res.json({ data: hotel });
});

export default router;
