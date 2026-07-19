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
  ENTRY_TYPES,
  SOURCE_TYPES,
} from "../schemas/cashbook";
import { CashBookService } from "../services/CashBookService";

// No requirePermission — permissions table is seeded empty.
const router: Router = Router();
router.use(authenticate, tenantMiddleware);

// GET /api/cashbook/accounts
router.get("/accounts", async (req, res) => {
  const accounts = await CashBookService.getAccounts(req.user!.hotelId);
  res.json({ data: accounts });
});

// POST /api/cashbook/accounts
router.post("/accounts", async (req, res) => {
  const dto     = createAccountSchema.parse(req.body);
  const account = await CashBookService.createAccount(req.user!.hotelId, dto, req.user!.userId);
  res.status(201).json({ data: account });
});

// PATCH /api/cashbook/accounts/:id/opening
router.patch("/accounts/:id/opening", async (req, res) => {
  const { id }  = req.params as { id: string };
  const dto     = openingBalanceSchema.parse(req.body);
  const entry   = await CashBookService.setOpeningBalance(
    req.user!.hotelId, id, dto.amount, req.user!.userId,
  );
  res.json({ data: entry });
});

// GET /api/cashbook/balances
router.get("/balances", async (req, res) => {
  const query    = balancesQuerySchema.parse(req.query);
  const balances = await CashBookService.getBalances(req.user!.hotelId, query);
  res.json({ data: balances });
});

// GET /api/cashbook/summary
router.get("/summary", async (req, res) => {
  const query   = summaryQuerySchema.parse(req.query);
  const summary = await CashBookService.getSummary(req.user!.hotelId, query);
  res.json({ data: summary });
});

// GET /api/cashbook/ledger
router.get("/ledger", async (req, res) => {
  const query  = ledgerQuerySchema.parse(req.query);
  const result = await CashBookService.getLedger(req.user!.hotelId, query);
  res.json(result);
});

// GET /api/cashbook/export — all matching entries for the active filters, no pagination cap
router.get("/export", async (req, res) => {
  const filters = summaryQuerySchema.extend({
    entryType:  z.enum(ENTRY_TYPES).optional(),
    sourceType: z.enum(SOURCE_TYPES).optional(),
    accountId:  z.string().uuid().optional(),
  }).parse(req.query);

  const [result, summary] = await Promise.all([
    CashBookService.getLedger(req.user!.hotelId, { ...filters, page: 1, limit: 10_000 }),
    CashBookService.getSummary(req.user!.hotelId, { startDate: filters.startDate, endDate: filters.endDate }),
  ]);

  res.json({ data: { entries: result.data, summary, filters } });
});

// POST /api/cashbook/entries
router.post("/entries", async (req, res) => {
  const dto   = createEntrySchema.parse(req.body);
  const entry = await CashBookService.createEntry(req.user!.hotelId, dto, req.user!.userId);
  res.status(201).json({ data: entry });
});

export default router;
