import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { tenantMiddleware } from "../middleware/tenant";
import { requirePermission } from "../middleware/permission";
import { listQrOrdersSchema, advanceStatusSchema, editOrderSchema } from "../schemas/qrMenu";
import { QrOrderService } from "../services/QrOrderService";

const router = Router();
router.use(authenticate, tenantMiddleware);

// GET /api/qr-orders — list all orders with items
router.get("/", requirePermission("pos:read"), async (req, res) => {
  const params = listQrOrdersSchema.parse(req.query);
  const result = await QrOrderService.listOrders(req.user!.hotelId, params);
  res.json(result);
});

// PATCH /api/qr-orders/:id/edit — kitchen manager edits items/delivery/instructions
router.patch("/:id/edit", requirePermission("pos:manage"), async (req, res) => {
  const dto = editOrderSchema.parse(req.body);
  const order = await QrOrderService.editOrder(
    req.user!.hotelId,
    req.params["id"] as string,
    dto,
    req.user!.userId,
  );
  res.json({ data: order });
});

// PATCH /api/qr-orders/:id/status — advance or cancel an order
router.patch("/:id/status", requirePermission("pos:manage"), async (req, res) => {
  const dto = advanceStatusSchema.parse(req.body);
  const order = await QrOrderService.advanceStatus(
    req.user!.hotelId,
    req.params["id"] as string,
    dto,
    req.user!.userId,
  );
  res.json({ data: order });
});

// PATCH /api/qr-orders/:id/post-to-folio — manual staff folio post
router.patch("/:id/post-to-folio", requirePermission("pos:manage"), async (req, res) => {
  const order = await QrOrderService.postToFolio(
    req.user!.hotelId,
    req.params["id"] as string,
    req.user!.userId,
  );
  res.json({ data: order });
});

// DELETE /api/qr-orders/:id — cancel and soft-delete (cancel only, no hard delete)
router.delete("/:id", requirePermission("pos:manage"), async (req, res) => {
  const order = await QrOrderService.cancelOrder(
    req.user!.hotelId,
    req.params["id"] as string,
    req.user!.userId,
  );
  res.json({ data: order });
});

export default router;
