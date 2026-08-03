import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { tenantMiddleware } from "../middleware/tenant";
import { requirePermission } from "../middleware/permission";
import { addFolioItemSchema, addPaymentSchema, refundPaymentSchema } from "../schemas/folio";
import { FolioService } from "../services/FolioService";
import { createLedgerEntryFromPayment, createLedgerEntryFromRefund } from "../services/CashBookService";
import { CompanyService } from "../services/CompanyService";
import { transferFolioSchema } from "../schemas/companies";
import { AppError } from "../utils/AppError";

const router: Router = Router();

router.use(authenticate, tenantMiddleware);

// GET /api/reservations/:reservationId/folio
router.get("/:reservationId/folio", requirePermission("FOLIO_READ"), async (req, res) => {
  const { reservationId } = req.params as { reservationId: string };
  const folio = await FolioService.get(req.withTenant, reservationId);
  res.json({ data: folio });
});

router.post("/:reservationId/folio/payments/:paymentId/refund", requirePermission("PAYMENT_REFUND"), async (req, res) => {
  const { reservationId, paymentId } = req.params as { reservationId: string; paymentId: string };
  const dto = refundPaymentSchema.parse(req.body);
  const refund = await FolioService.refundPayment(req.withTenant, req.user!, reservationId, paymentId, dto);
  res.status(201).json({ data: refund });
  createLedgerEntryFromRefund(
    req.user!.hotelId,
    { id: refund.id, amount: refund.amount, method: refund.method, reservationId },
    req.user!.userId,
  ).catch(() => { /* logged and repairable by source id */ });
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

// POST /api/reservations/:reservationId/folio/transfer-to-company
// Moves the folio's outstanding balance onto a company's credit account. Also
// reachable implicitly at checkout, but exposed here so staff can settle a bill
// to an agency at any point during the stay.
router.post("/:reservationId/folio/transfer-to-company", requirePermission("COMPANY_LEDGER_POST"), async (req, res) => {
  const { reservationId } = req.params as { reservationId: string };
  const dto = transferFolioSchema.parse(req.body);

  const folio = await req.withTenant((db) =>
    db.folio.findFirst({ where: { reservationId }, select: { id: true } })
  );
  if (!folio) throw new AppError(404, "This reservation has no folio");

  const result = await CompanyService.transferFolioStandalone(req.withTenant, req.user!, folio.id, dto);
  res.status(201).json({ data: result });
});

export default router;
