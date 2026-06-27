import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { tenantMiddleware } from "../middleware/tenant";
import { requirePermission } from "../middleware/permission";
import { addFolioItemSchema, addPaymentSchema } from "../schemas/folio";
import { FolioService } from "../services/FolioService";
import { createLedgerEntryFromPayment } from "../services/CashBookService";

const router = Router();

router.use(authenticate, tenantMiddleware);

// GET /api/reservations/:reservationId/folio
router.get("/:reservationId/folio", requirePermission("FOLIO_READ"), async (req, res) => {
  const { reservationId } = req.params as { reservationId: string };
  const folio = await FolioService.get(req.withTenant, reservationId);
  res.json({ data: folio });
});

// POST /api/reservations/:reservationId/folio/items
router.post("/:reservationId/folio/items", requirePermission("FOLIO_UPDATE"), async (req, res) => {
  const { reservationId } = req.params as { reservationId: string };
  const dto  = addFolioItemSchema.parse(req.body);
  const item = await FolioService.addItem(req.withTenant, req.user!, reservationId, dto);
  res.status(201).json({ data: item });
});

// DELETE /api/reservations/:reservationId/folio/items/:itemId
router.delete("/:reservationId/folio/items/:itemId", requirePermission("FOLIO_UPDATE"), async (req, res) => {
  const { reservationId, itemId } = req.params as { reservationId: string; itemId: string };
  await FolioService.voidItem(req.withTenant, req.user!, reservationId, itemId);
  res.status(204).send();
});

// POST /api/reservations/:reservationId/folio/payments
router.post("/:reservationId/folio/payments", requirePermission("PAYMENT_CREATE"), async (req, res) => {
  const { reservationId } = req.params as { reservationId: string };
  const dto     = addPaymentSchema.parse(req.body);
  const payment = await FolioService.addPayment(req.withTenant, req.user!, reservationId, dto);
  res.status(201).json({ data: payment });

  // Auto-entry in cash book — fire-and-forget, never fails the payment
  createLedgerEntryFromPayment(
    req.user!.hotelId,
    { id: payment.id, amount: payment.amount, method: payment.method, reservationId },
    req.user!.userId,
  ).catch(() => { /* already logged inside */ });
});

export default router;
