import { Router } from "express";
import { createHash } from "node:crypto";
import { authenticate } from "../middleware/auth";
import { tenantMiddleware } from "../middleware/tenant";
import { requirePermission } from "../middleware/permission";
import { AccountingService } from "../services/AccountingService";
import { AppError } from "../utils/AppError";
import { exportQuerySchema, updateMappingsSchema } from "../schemas/accounting";
import { genericJournalCsv, tallyJournalXml, fileNameFor, contentTypeFor } from "../lib/accounting/formats";

const router: Router = Router();
router.use(authenticate, tenantMiddleware);

// ── Chart of accounts mapping ────────────────────────────────────────────────

router.get("/mappings", requirePermission("reports:read"), async (req, res) => {
  const mappings = await AccountingService.getMappings(req.withTenant, req.user!.hotelId);
  res.json({ data: mappings });
});

router.put("/mappings", requirePermission("settings:update"), async (req, res) => {
  const dto = updateMappingsSchema.parse(req.body);
  const mappings = await AccountingService.updateMappings(req.withTenant, req.user!, dto);
  res.json({ data: mappings });
});

router.post("/mappings/reset", requirePermission("settings:update"), async (req, res) => {
  const mappings = await AccountingService.resetMappings(req.withTenant, req.user!);
  res.json({ data: mappings });
});

// ── Preview ──────────────────────────────────────────────────────────────────

/**
 * Account-level totals for the period without generating a file.
 *
 * The accountant checks the numbers and the balance indicator here before
 * downloading anything, so a misconfigured mapping is caught before it reaches
 * their books rather than after.
 */
router.get("/preview", requirePermission("reports:read"), async (req, res) => {
  const query = exportQuerySchema.parse(req.query);
  const batch = await AccountingService.buildJournal(req.withTenant, req.user!.hotelId, query);

  const byAccount = new Map<string, { accountCode: string; accountName: string; debit: number; credit: number }>();
  for (const line of batch.lines) {
    const entry = byAccount.get(line.accountCode)
      ?? { accountCode: line.accountCode, accountName: line.accountName, debit: 0, credit: 0 };
    entry.debit  += line.debit;
    entry.credit += line.credit;
    byAccount.set(line.accountCode, entry);
  }

  const priorExports = await AccountingService.listExports(req.withTenant);
  const overlapping = priorExports.filter((e) =>
    e.periodStart.toISOString().slice(0, 10) <= query.to &&
    e.periodEnd.toISOString().slice(0, 10)   >= query.from
  );

  res.json({
    data: [...byAccount.values()].sort((a, b) => a.accountCode.localeCompare(b.accountCode)),
    meta: {
      periodStart: batch.periodStart,
      periodEnd:   batch.periodEnd,
      lineCount:   batch.lines.length,
      totalDebit:  batch.totalDebit,
      totalCredit: batch.totalCredit,
      balanced:    batch.balanced,
      basis:       "ACCRUAL",
      granularity: query.granularity,
      // Non-empty means this period was exported before — the UI warns, because
      // importing the same journal twice doubles a month of revenue.
      priorExports: overlapping.map((e) => ({
        id: e.id, format: e.format, createdAt: e.createdAt,
        periodStart: e.periodStart, periodEnd: e.periodEnd, lineCount: e.lineCount,
      })),
    },
  });
});

// ── Export history ───────────────────────────────────────────────────────────

router.get("/exports", requirePermission("reports:read"), async (req, res) => {
  const exports = await AccountingService.listExports(req.withTenant);
  res.json({ data: exports });
});

// ── File download ────────────────────────────────────────────────────────────

router.get("/export", requirePermission("reports:read"), async (req, res) => {
  const query = exportQuerySchema.parse(req.query);
  const batch = await AccountingService.buildJournal(req.withTenant, req.user!.hotelId, query);

  // Refuse rather than hand over a file that will not reconcile. An unbalanced
  // journal that reaches an accountant's books is far more expensive to undo
  // than a failed download.
  if (!batch.balanced) {
    throw new AppError(500, "Refusing to export: the journal does not balance. Check your account mappings and contact support.", {
      totalDebit: batch.totalDebit, totalCredit: batch.totalCredit,
    });
  }
  if (batch.lines.length === 0) {
    throw new AppError(400, "No accounting activity in the selected period.");
  }

  const hotel = await req.withTenant((db) =>
    db.hotel.findUnique({ where: { id: req.user!.hotelId }, select: { name: true } })
  );

  const body = query.format === "TALLY_XML"
    ? tallyJournalXml(batch, hotel?.name ?? "Hotel")
    : genericJournalCsv(batch);

  const contentHash = createHash("sha256").update(body).digest("hex");
  await AccountingService.recordExport(req.withTenant, req.user!, query, batch, contentHash);

  res.setHeader("Content-Type", contentTypeFor(query.format));
  res.setHeader("Content-Disposition", `attachment; filename="${fileNameFor(query.format, query.from, query.to)}"`);
  res.send(body);
});

export default router;
