import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import { tenantMiddleware } from "../middleware/tenant";
import {
  createAccountSchema,
  openingBalanceSchema,
  createEntrySchema,
  ledgerQuerySchema,
  summaryQuerySchema,
  balancesQuerySchema,
  transferSchema,
  ENTRY_TYPES,
  SOURCE_TYPES,
} from "../schemas/cashbook";
import { CashBookService, reconcileCashBook } from "../services/CashBookService";
import { requirePermission } from "../middleware/permission";

const router: Router = Router();
router.use(authenticate, tenantMiddleware);

// GET /api/cashbook/accounts
router.get("/accounts", requirePermission("cashbook:read"), async (req, res) => {
  await Promise.all(
    (["CASH_DRAWER", "BANK_ACCOUNT", "JAZZCASH", "EASYPAISA", "PETTY_CASH"] as const)
      .map((type) => CashBookService.getOrCreateAccount(req.user!.hotelId, type, req.user!.userId)),
  );
  const accounts = await CashBookService.getAccounts(req.user!.hotelId);
  res.json({ data: accounts });
});

// POST /api/cashbook/accounts
router.post("/accounts", requirePermission("cashbook:create"), async (req, res) => {
  const dto     = createAccountSchema.parse(req.body);
  const account = await CashBookService.createAccount(req.user!.hotelId, dto, req.user!.userId);
  res.status(201).json({ data: account });
});

// PATCH /api/cashbook/accounts/:id/opening
router.patch("/accounts/:id/opening", requirePermission("cashbook:create"), async (req, res) => {
  const { id }  = req.params as { id: string };
  const dto     = openingBalanceSchema.parse(req.body);
  const entry   = await CashBookService.setOpeningBalance(
    req.user!.hotelId, id, dto.amount, req.user!.userId,
  );
  res.json({ data: entry });
});

// GET /api/cashbook/balances
router.get("/balances", requirePermission("cashbook:read"), async (req, res) => {
  const query    = balancesQuerySchema.parse(req.query);
  const balances = await CashBookService.getBalances(req.user!.hotelId, query);
  res.json({ data: balances });
});

// GET /api/cashbook/summary
router.get("/summary", requirePermission("cashbook:read"), async (req, res) => {
  const query   = summaryQuerySchema.parse(req.query);
  const summary = await CashBookService.getSummary(req.user!.hotelId, query);
  res.json({ data: summary });
});

// GET /api/cashbook/ledger
router.get("/ledger", requirePermission("cashbook:read"), async (req, res) => {
  const query  = ledgerQuerySchema.parse(req.query);
  const result = await CashBookService.getLedger(req.user!.hotelId, query);
  res.json(result);
});

// GET /api/cashbook/export — all matching entries for the active filters, no pagination cap
router.get("/export", requirePermission("cashbook:read"), async (req, res) => {
  const filters = summaryQuerySchema.extend({
    entryType:  z.enum(ENTRY_TYPES).optional(),
    sourceType: z.enum(SOURCE_TYPES).optional(),
    accountId:  z.string().uuid().optional(),
  }).parse(req.query);

  const result = await CashBookService.exportLedger(req.user!.hotelId, filters);
  res.json({ data: { ...result, filters } });
});

// POST /api/cashbook/entries
router.post("/entries", requirePermission("cashbook:create"), async (req, res) => {
  const dto   = createEntrySchema.parse(req.body);
  const entry = await CashBookService.createEntry(req.user!.hotelId, dto, req.user!.userId);
  res.status(201).json({ data: entry });
});

router.post("/transfers", requirePermission("cashbook:create"), async (req, res) => {
  const dto = transferSchema.parse(req.body);
  const transfer = await CashBookService.createTransfer(req.user!.hotelId, dto, req.user!.userId);
  res.status(201).json({ data: transfer });
});

router.post("/reconcile", requirePermission("cashbook:create"), async (req, res) => {
  const result = await reconcileCashBook(req.user!.hotelId, req.user!.userId);
  res.json({ data: result });
});

export default router;
