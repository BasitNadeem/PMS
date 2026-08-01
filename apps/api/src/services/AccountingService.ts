import type { TenantTx } from "@pms/db";
import { FolioItemType, PaymentStatus, Prisma } from "@pms/db";
import type { JwtPayload } from "../middleware/auth";
import { AppError } from "../utils/AppError";
import { notifyHotelDataChanged } from "../lib/realtime";
import {
  DEFAULT_ACCOUNTS, SYSTEM_KEYS, DEFAULT_EXPENSE_ACCOUNT, DEFAULT_REVENUE_ACCOUNT,
  type AccountScope,
} from "../lib/accounting/chartOfAccounts";
import {
  debit, credit, dropEmpty, summariseByDay, buildBatch,
  type JournalLine, type JournalBatch,
} from "../lib/accounting/journal";
import type { ExportQuery, UpdateMappingsDto } from "../schemas/accounting";

type WithTenantFn = <T>(fn: (db: TenantTx) => Promise<T>) => Promise<T>;

interface Account { accountCode: string; accountName: string }

/** Lookup over the hotel's mappings with sensible fallbacks. */
class Chart {
  constructor(private readonly rows: Array<{ scope: string; key: string; accountCode: string; accountName: string }>) {}

  private find(scope: AccountScope, key: string): Account | null {
    const row = this.rows.find((r) => r.scope === scope && r.key === key);
    return row ? { accountCode: row.accountCode, accountName: row.accountName } : null;
  }

  system(key: string): Account {
    const found = this.find("SYSTEM", key);
    // A missing system account means seeding did not run or a row was deleted;
    // the journal cannot be built correctly without it, so fail loudly rather
    // than silently posting to a fallback and quietly unbalancing the books.
    if (!found) throw new AppError(500, `Accounting mapping missing for system account "${key}". Reset mappings to defaults in Settings.`);
    return found;
  }

  revenue(folioItemType: string): Account {
    return this.find("FOLIO_ITEM_TYPE", folioItemType) ?? DEFAULT_REVENUE_ACCOUNT;
  }

  tax(taxType: string): Account {
    return this.find("TAX_TYPE", taxType) ?? { accountCode: "2300", accountName: "Tax Payable" };
  }

  payment(method: string): Account {
    return this.find("PAYMENT_METHOD", method) ?? { accountCode: "1100", accountName: "Cash in Hand" };
  }

  expense(category: string): Account {
    return this.find("EXPENSE_CATEGORY", category) ?? DEFAULT_EXPENSE_ACCOUNT;
  }
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export const AccountingService = {
  /**
   * Returns the hotel's mappings, seeding the defaults the first time.
   *
   * Seeding lazily rather than in the tenant-creation path means existing
   * hotels get a working chart without a data migration, and a hotel that
   * never opens this screen never carries the rows.
   */
  async getMappings(withTenant: WithTenantFn, hotelId: string) {
    return withTenant(async (db) => {
      const existing = await db.accountingAccount.findMany({
        orderBy: [{ scope: "asc" }, { accountCode: "asc" }],
      });
      if (existing.length > 0) return existing;

      await db.accountingAccount.createMany({
        data: DEFAULT_ACCOUNTS.map((a) => ({ hotelId, ...a })),
        skipDuplicates: true,
      });
      return db.accountingAccount.findMany({ orderBy: [{ scope: "asc" }, { accountCode: "asc" }] });
    });
  },

  async updateMappings(withTenant: WithTenantFn, actor: JwtPayload, dto: UpdateMappingsDto) {
    const result = await withTenant(async (db) => {
      for (const entry of dto.mappings) {
        await db.accountingAccount.upsert({
          where:  { hotelId_scope_key: { hotelId: actor.hotelId, scope: entry.scope, key: entry.key } },
          create: { hotelId: actor.hotelId, ...entry },
          update: { accountCode: entry.accountCode, accountName: entry.accountName },
        });
      }

      await db.auditLog.create({
        data: {
          hotelId:  actor.hotelId,
          userId:   actor.userId,
          action:   "ACCOUNTING_MAPPINGS_UPDATE",
          entity:   "accounting_account",
          entityId: actor.hotelId,
          after:    JSON.parse(JSON.stringify({ count: dto.mappings.length })),
        },
      });

      return db.accountingAccount.findMany({ orderBy: [{ scope: "asc" }, { accountCode: "asc" }] });
    });

    notifyHotelDataChanged(actor.hotelId);
    return result;
  },

  async resetMappings(withTenant: WithTenantFn, actor: JwtPayload) {
    return withTenant(async (db) => {
      await db.accountingAccount.deleteMany({});
      await db.accountingAccount.createMany({
        data: DEFAULT_ACCOUNTS.map((a) => ({ hotelId: actor.hotelId, ...a })),
      });
      await db.auditLog.create({
        data: {
          hotelId:  actor.hotelId,
          userId:   actor.userId,
          action:   "ACCOUNTING_MAPPINGS_RESET",
          entity:   "accounting_account",
          entityId: actor.hotelId,
        },
      });
      return db.accountingAccount.findMany({ orderBy: [{ scope: "asc" }, { accountCode: "asc" }] });
    });
  },

  /**
   * Builds the journal for a period on an accrual basis.
   *
   * Accrual rather than cash: revenue is recognised when the charge is posted
   * to the folio and sits in Accounts Receivable until settled. That is what
   * the folio data actually models, and netting it down to cash would lose the
   * receivable, the tax liability and the deposit balance entirely.
   *
   * Deliberately does NOT read `ledger_entries`. That table records cash
   * movements against cash accounts only — it never sees an unpaid charge, a
   * tax split or a guest deposit, so exporting from it would hand the
   * accountant an incomplete set of books.
   */
  async buildJournal(withTenant: WithTenantFn, hotelId: string, query: ExportQuery): Promise<JournalBatch> {
    const from = new Date(`${query.from}T00:00:00.000Z`);
    // Exclusive upper bound, so a charge posted at 23:30 on the last day is in.
    const toExclusive = new Date(`${query.to}T00:00:00.000Z`);
    toExclusive.setUTCDate(toExclusive.getUTCDate() + 1);

    const mappingRows = await this.getMappings(withTenant, hotelId);
    const chart = new Chart(mappingRows);

    const { folioItems, payments, expenses } = await withTenant(async (db) => ({
      // Voided items are excluded outright: a void inside the period never
      // happened as far as the books are concerned. A void of an item from an
      // already-exported period is handled by the reversal note in the UI —
      // full period locking is a later step.
      folioItems: await db.folioItem.findMany({
        where:  { chargeDate: { gte: from, lt: toExclusive }, isVoided: false },
        select: {
          id: true, type: true, description: true, amount: true, taxAmount: true,
          netAmount: true, discountAmount: true, chargeDate: true,
        },
        orderBy: { chargeDate: "asc" },
      }),
      payments: await db.payment.findMany({
        where:  { postedAt: { gte: from, lt: toExclusive }, status: PaymentStatus.COMPLETED },
        select: {
          id: true, method: true, amount: true, isRefund: true, postedAt: true,
          receiptNumber: true, reservationId: true,
          reservation: { select: { status: true, actualCheckIn: true } },
        },
        orderBy: { postedAt: "asc" },
      }),
      expenses: await db.$queryRaw<Array<{
        id: string; date: Date; category: string; description: string;
        amount: number; payment_method: string; paid_to: string;
      }>>`
        SELECT id, date, category, description, amount, payment_method, paid_to
        FROM expenses
        WHERE date >= ${from}::date AND date < ${toExclusive}::date
        ORDER BY date ASC
      `,
    }));

    // Tax types configured for this hotel, used to split the TAX folio lines
    // across the right liability accounts by proportion of their rates.
    const taxConfigs = await withTenant((db) =>
      db.taxConfig.findMany({ where: { isActive: true }, select: { taxType: true, rate: true } })
    );

    const lines: JournalLine[] = [];

    // ── Revenue: charge posted → receivable owed, revenue earned ─────────────
    for (const item of folioItems) {
      const date = isoDate(item.chargeDate);
      const ref  = `FOLIO_ITEM:${item.id}`;

      if (item.type === FolioItemType.TAX) {
        // A standalone tax line: receivable up, tax liability up.
        lines.push(debit(date, chart.system(SYSTEM_KEYS.ACCOUNTS_RECEIVABLE), item.amount, item.description, ref));
        lines.push(...splitTax(date, item.amount, item.description, ref, taxConfigs, chart));
        continue;
      }

      if (item.type === FolioItemType.DISCOUNT) {
        // Contra-revenue: the discount reduces what is owed, and is shown as
        // its own expense-like account rather than shrinking gross revenue.
        lines.push(debit(date, chart.system(SYSTEM_KEYS.DISCOUNTS_ALLOWED), item.amount, item.description, ref));
        lines.push(credit(date, chart.system(SYSTEM_KEYS.ACCOUNTS_RECEIVABLE), item.amount, item.description, ref));
        continue;
      }

      const gross = item.amount;
      const tax   = item.taxAmount;
      const net   = gross - tax;

      lines.push(debit(date, chart.system(SYSTEM_KEYS.ACCOUNTS_RECEIVABLE), gross, item.description, ref));
      lines.push(credit(date, chart.revenue(item.type), net, item.description, ref));
      if (tax > 0) {
        lines.push(...splitTax(date, tax, `${item.description} — tax`, ref, taxConfigs, chart));
      }
    }

    // ── Payments: cash in, receivable down ──────────────────────────────────
    for (const payment of payments) {
      const date = isoDate(payment.postedAt);
      const ref  = `PAYMENT:${payment.id}`;
      const desc = payment.receiptNumber
        ? `Payment ${payment.receiptNumber}`
        : payment.isRefund ? "Refund" : "Payment received";

      // A payment taken before the guest checks in is money held, not earned.
      // It sits in Guest Advances until the stay begins and charges appear.
      const isAdvance = !payment.isRefund
        && payment.reservation !== null
        && payment.reservation.actualCheckIn === null;

      const counterAccount = isAdvance
        ? chart.system(SYSTEM_KEYS.GUEST_ADVANCES)
        : chart.system(SYSTEM_KEYS.ACCOUNTS_RECEIVABLE);

      if (payment.isRefund) {
        // A reversal, never a negative amount — negative debits break imports
        // and hide the gross movement from the accountant.
        lines.push(debit(date, counterAccount, payment.amount, `${desc} (refund)`, ref));
        lines.push(credit(date, chart.payment(payment.method), payment.amount, `${desc} (refund)`, ref));
      } else {
        lines.push(debit(date, chart.payment(payment.method), payment.amount, desc, ref));
        lines.push(credit(date, counterAccount, payment.amount, desc, ref));
      }
    }

    // ── Expenses: cost incurred, cash out ───────────────────────────────────
    for (const expense of expenses) {
      const date = isoDate(expense.date);
      const ref  = `EXPENSE:${expense.id}`;
      const desc = `${expense.description}${expense.paid_to ? ` — ${expense.paid_to}` : ""}`;
      lines.push(debit(date, chart.expense(expense.category), expense.amount, desc, ref));
      lines.push(credit(date, chart.payment(expense.payment_method), expense.amount, desc, ref));
    }

    const cleaned = dropEmpty(lines);
    const final = query.granularity === "TRANSACTION" ? cleaned : summariseByDay(cleaned);

    return buildBatch(query.from, query.to, final);
  },

  /** Past exports, so the UI can warn before a period is generated twice. */
  async listExports(withTenant: WithTenantFn) {
    return withTenant((db) =>
      db.accountingExport.findMany({ orderBy: { createdAt: "desc" }, take: 50 })
    );
  },

  async recordExport(
    withTenant: WithTenantFn, actor: JwtPayload, query: ExportQuery,
    batch: JournalBatch, contentHash: string,
  ) {
    return withTenant((db) =>
      db.accountingExport.create({
        data: {
          hotelId:       actor.hotelId,
          periodStart:   new Date(`${query.from}T00:00:00.000Z`),
          periodEnd:     new Date(`${query.to}T00:00:00.000Z`),
          format:        query.format,
          basis:         "ACCRUAL",
          granularity:   query.granularity,
          lineCount:     batch.lines.length,
          totalDebit:    batch.totalDebit,
          totalCredit:   batch.totalCredit,
          contentHash,
          generatedById: actor.userId,
        },
      })
    );
  },
};

/**
 * Splits a tax amount across the hotel's configured tax types in proportion to
 * their rates.
 *
 * The folio stores one combined tax figure, but an accountant needs GST and
 * provincial sales tax in separate liability accounts. Proportional split by
 * configured rate reproduces the original calculation.
 *
 * Any rounding remainder is forced onto the largest component rather than left
 * to drift — a one-paisa gap would unbalance the whole batch.
 */
function splitTax(
  date: string,
  amount: number,
  narration: string,
  reference: string,
  configs: Array<{ taxType: string; rate: Prisma.Decimal }>,
  chart: Chart,
): JournalLine[] {
  if (amount === 0) return [];

  if (configs.length === 0) {
    return [credit(date, { accountCode: "2300", accountName: "Tax Payable" }, amount, narration, reference)];
  }

  const rates = configs.map((c) => Number(c.rate));
  const rateTotal = rates.reduce((s, r) => s + r, 0);
  if (rateTotal <= 0) {
    return [credit(date, { accountCode: "2300", accountName: "Tax Payable" }, amount, narration, reference)];
  }

  const parts = configs.map((c, i) => ({
    taxType: c.taxType,
    value:   Math.floor((amount * rates[i]!) / rateTotal),
  }));

  const assigned = parts.reduce((s, p) => s + p.value, 0);
  const remainder = amount - assigned;
  if (remainder !== 0) {
    const largest = parts.reduce((max, p) => (p.value > max.value ? p : max), parts[0]!);
    largest.value += remainder;
  }

  return parts
    .filter((p) => p.value !== 0)
    .map((p) => credit(date, chart.tax(p.taxType), p.value, narration, reference));
}
