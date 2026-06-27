/**
 * CashBookService — uses adminPrisma.$queryRaw / $executeRaw
 *
 * Run this SQL in your DB if not already done:
 *
 * DROP TABLE IF EXISTS ledger_entries;
 * DROP TABLE IF EXISTS cash_accounts;
 *
 * CREATE TABLE cash_accounts (
 *   id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
 *   hotel_id     UUID         NOT NULL,
 *   name         VARCHAR(255) NOT NULL,
 *   account_type VARCHAR(50)  NOT NULL,
 *   balance      INTEGER      NOT NULL DEFAULT 0,
 *   created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
 *   updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
 * );
 * CREATE INDEX cash_accounts_hotel_id_idx ON cash_accounts(hotel_id);
 *
 * CREATE TABLE ledger_entries (
 *   id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
 *   hotel_id       UUID        NOT NULL,
 *   account_id     UUID        NOT NULL,
 *   entry_type     VARCHAR(20) NOT NULL,
 *   amount         INTEGER     NOT NULL,
 *   balance_after  INTEGER     NOT NULL,
 *   source_type    VARCHAR(50) NOT NULL DEFAULT 'OTHER',
 *   source_id      UUID,
 *   description    TEXT        NOT NULL,
 *   payment_method VARCHAR(50),
 *   entry_date     DATE        NOT NULL DEFAULT CURRENT_DATE,
 *   notes          TEXT,
 *   recorded_by_id UUID,
 *   created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
 *   updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
 * );
 * CREATE INDEX ledger_entries_hotel_id_idx  ON ledger_entries(hotel_id);
 * CREATE INDEX ledger_entries_account_id_idx ON ledger_entries(account_id);
 * CREATE INDEX ledger_entries_date_idx       ON ledger_entries(hotel_id, entry_date DESC);
 */

import { adminPrisma, Prisma } from "@pms/db";
import { AppError } from "../utils/AppError";
import { paginationMeta } from "../utils/pagination";
import type { AccountType, BalancesQuery, CreateAccountDto, CreateEntryDto, LedgerQuery, SummaryQuery } from "../schemas/cashbook";

// ── Row types ─────────────────────────────────────────────────────────────────

export interface CashAccountRow {
  id:           string;
  hotel_id:     string;
  name:         string;
  account_type: string;
  balance:      number;
  created_at:   Date;
  updated_at:   Date;
}

export interface LedgerEntryRow {
  id:             string;
  hotel_id:       string;
  account_id:     string;
  entry_type:     string;
  amount:         number;
  balance_after:  number;
  source_type:    string;
  source_id:      string | null;
  description:    string;
  payment_method: string | null;
  entry_date:     Date;
  notes:          string | null;
  recorded_by_id: string | null;
  created_at:     Date;
  updated_at:     Date;
  // joined
  account_name:  string;
  account_type:  string;
  recorder_name: string | null;
}

// ── Payment method → account type mapping ─────────────────────────────────────

const PAYMENT_METHOD_TO_ACCOUNT: Record<string, AccountType> = {
  CASH:          "CASH_DRAWER",
  JAZZCASH:      "JAZZCASH",
  EASYPAISA:     "EASYPAISA",
  CREDIT_CARD:   "BANK_ACCOUNT",
  DEBIT_CARD:    "BANK_ACCOUNT",
  BANK_TRANSFER: "BANK_ACCOUNT",
  CHEQUE:        "BANK_ACCOUNT",
};

const EXPENSE_METHOD_TO_ACCOUNT: Record<string, AccountType> = {
  CASH:          "CASH_DRAWER",
  BANK_TRANSFER: "BANK_ACCOUNT",
  CHEQUE:        "BANK_ACCOUNT",
  ONLINE:        "BANK_ACCOUNT",
};

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  CASH_DRAWER:  "Cash Drawer",
  BANK_ACCOUNT: "Bank Account",
  JAZZCASH:     "JazzCash",
  EASYPAISA:    "Easypaisa",
  PETTY_CASH:   "Petty Cash",
  OTHER:        "Other",
};

// ── Service ───────────────────────────────────────────────────────────────────

export const CashBookService = {

  async getAccounts(hotelId: string): Promise<CashAccountRow[]> {
    try {
      return await adminPrisma.$queryRaw<CashAccountRow[]>`
        SELECT * FROM cash_accounts
        WHERE hotel_id = ${hotelId}::uuid
        ORDER BY account_type ASC, created_at ASC
      `;
    } catch (err) {
      console.error("[CashBook] getAccounts error:", err);
      throw new AppError(500, "Failed to load cash accounts");
    }
  },

  async getOrCreateAccount(hotelId: string, accountType: AccountType, _actorId: string): Promise<CashAccountRow> {
    try {
      const existing = await adminPrisma.$queryRaw<CashAccountRow[]>`
        SELECT * FROM cash_accounts
        WHERE hotel_id = ${hotelId}::uuid AND account_type = ${accountType}
        LIMIT 1
      `;
      if (existing.length > 0) return existing[0];

      const created = await adminPrisma.$queryRaw<CashAccountRow[]>`
        INSERT INTO cash_accounts (hotel_id, name, account_type, balance)
        VALUES (${hotelId}::uuid, ${ACCOUNT_TYPE_LABELS[accountType]}, ${accountType}, 0)
        RETURNING *
      `;
      return created[0];
    } catch (err) {
      console.error("[CashBook] getOrCreateAccount error:", err);
      throw new AppError(500, "Failed to get or create cash account");
    }
  },

  async createAccount(hotelId: string, dto: CreateAccountDto, _actorId: string): Promise<CashAccountRow> {
    try {
      const rows = await adminPrisma.$queryRaw<CashAccountRow[]>`
        INSERT INTO cash_accounts (hotel_id, name, account_type, balance)
        VALUES (${hotelId}::uuid, ${dto.name}, ${dto.accountType}, 0)
        RETURNING *
      `;
      if (!rows[0]) throw new AppError(500, "Insert returned no row");
      return rows[0];
    } catch (err) {
      if (err instanceof AppError) throw err;
      console.error("[CashBook] createAccount SQL error:", err);
      // Surface the real DB error so it's visible in the frontend during development
      const msg = err instanceof Error ? err.message : "Unknown database error";
      throw new AppError(500, `Failed to create account: ${msg}`);
    }
  },

  async createEntry(hotelId: string, dto: CreateEntryDto, actorId: string): Promise<LedgerEntryRow> {
    // Resolve account: use explicit accountId or fall back to CASH_DRAWER
    const resolvedAccountId = dto.accountId
      ?? (await CashBookService.getOrCreateAccount(hotelId, "CASH_DRAWER", actorId)).id;

    const today     = new Date().toISOString().slice(0, 10);
    const entryDate = dto.entryDate ?? today;
    const sourceId  = (dto as CreateEntryDto & { sourceId?: string }).sourceId ?? null;

    try {
      return await adminPrisma.$transaction(async (tx) => {
        const [account] = await tx.$queryRaw<[{ id: string; hotel_id: string; balance: number }]>`
          SELECT id, hotel_id, balance FROM cash_accounts
          WHERE id = ${resolvedAccountId}::uuid AND hotel_id = ${hotelId}::uuid
          FOR UPDATE
        `;
        if (!account) throw new AppError(404, "Account not found");

        const newBalance = dto.entryType === "INCOMING"
          ? account.balance + dto.amount
          : account.balance - dto.amount;

        await tx.$executeRaw`
          UPDATE cash_accounts
          SET balance = ${newBalance}::int, updated_at = now()
          WHERE id = ${resolvedAccountId}::uuid
        `;

        const [entry] = await tx.$queryRaw<[LedgerEntryRow]>`
          INSERT INTO ledger_entries
            (hotel_id, account_id, entry_type, amount, balance_after,
             source_type, source_id, description, payment_method,
             entry_date, notes, recorded_by_id)
          VALUES
            (${hotelId}::uuid,
             ${resolvedAccountId}::uuid,
             ${dto.entryType},
             ${dto.amount}::int,
             ${newBalance}::int,
             ${dto.sourceType},
             ${sourceId}::uuid,
             ${dto.description},
             ${dto.paymentMethod ?? null},
             ${entryDate}::date,
             ${dto.notes ?? null},
             ${actorId}::uuid)
          RETURNING *,
            '' AS account_name,
            '' AS account_type,
            NULL::text AS recorder_name
        `;
        return entry;
      });
    } catch (err) {
      if (err instanceof AppError) throw err;
      console.error("[CashBook] createEntry SQL error:", err);
      const msg = err instanceof Error ? err.message : "Unknown database error";
      throw new AppError(500, `Failed to record entry: ${msg}`);
    }
  },

  async getSummary(hotelId: string, params: SummaryQuery) {
    const conds: Prisma.Sql[] = [Prisma.sql`hotel_id = ${hotelId}::uuid`];
    if (params.startDate) conds.push(Prisma.sql`entry_date >= ${params.startDate}::date`);
    if (params.endDate)   conds.push(Prisma.sql`entry_date <= ${params.endDate}::date`);

    const where = Prisma.join(conds, " AND ");

    try {
      const rows = await adminPrisma.$queryRaw<[{ total_incoming: bigint; total_outgoing: bigint }]>`
        SELECT
          COALESCE(SUM(CASE WHEN entry_type = 'INCOMING' THEN amount ELSE 0 END), 0)::bigint AS total_incoming,
          COALESCE(SUM(CASE WHEN entry_type = 'OUTGOING' THEN amount ELSE 0 END), 0)::bigint AS total_outgoing
        FROM ledger_entries
        WHERE ${where}
      `;
      const totalIn  = Number(rows[0]?.total_incoming ?? 0);
      const totalOut = Number(rows[0]?.total_outgoing ?? 0);
      return { totalIncoming: totalIn, totalOutgoing: totalOut, netFlow: totalIn - totalOut };
    } catch (err) {
      console.error("[CashBook] getSummary error:", err);
      return { totalIncoming: 0, totalOutgoing: 0, netFlow: 0 };
    }
  },

  async getBalances(hotelId: string, params: BalancesQuery) {
    const asOf = params.asOf ?? new Date().toISOString().slice(0, 10);
    try {
      const rows = await adminPrisma.$queryRaw<Array<{
        id:           string;
        name:         string;
        account_type: string;
        balance:      bigint;
        total_in:     bigint;
        total_out:    bigint;
      }>>`
        SELECT
          ca.id,
          ca.name,
          ca.account_type,
          COALESCE((
            SELECT le.balance_after
            FROM   ledger_entries le
            WHERE  le.account_id = ca.id
              AND  le.hotel_id   = ca.hotel_id
              AND  le.entry_date <= ${asOf}::date
            ORDER  BY le.entry_date DESC, le.created_at DESC
            LIMIT  1
          ), 0)::bigint AS balance,
          COALESCE((
            SELECT SUM(le.amount)
            FROM   ledger_entries le
            WHERE  le.account_id = ca.id
              AND  le.entry_type = 'INCOMING'
              AND  le.entry_date <= ${asOf}::date
          ), 0)::bigint AS total_in,
          COALESCE((
            SELECT SUM(le.amount)
            FROM   ledger_entries le
            WHERE  le.account_id = ca.id
              AND  le.entry_type = 'OUTGOING'
              AND  le.entry_date <= ${asOf}::date
          ), 0)::bigint AS total_out
        FROM  cash_accounts ca
        WHERE ca.hotel_id = ${hotelId}::uuid
        ORDER BY ca.account_type ASC
      `;
      return rows
        .map((r) => ({
          id:          r.id,
          name:        r.name,
          accountType: r.account_type,
          balance:     Number(r.balance),
          totalIn:     Number(r.total_in),
          totalOut:    Number(r.total_out),
        }))
        .filter((r) => r.totalIn > 0 || r.totalOut > 0);
    } catch (err) {
      console.error("[CashBook] getBalances error:", err);
      return [];
    }
  },

  async getLedger(hotelId: string, params: LedgerQuery) {
    const skip = (params.page - 1) * params.limit;

    const conds: Prisma.Sql[] = [Prisma.sql`le.hotel_id = ${hotelId}::uuid`];
    if (params.accountId)  conds.push(Prisma.sql`le.account_id = ${params.accountId}::uuid`);
    if (params.startDate)  conds.push(Prisma.sql`le.entry_date >= ${params.startDate}::date`);
    if (params.endDate)    conds.push(Prisma.sql`le.entry_date <= ${params.endDate}::date`);
    if (params.entryType)  conds.push(Prisma.sql`le.entry_type = ${params.entryType}`);
    if (params.sourceType) conds.push(Prisma.sql`le.source_type = ${params.sourceType}`);

    const where = Prisma.join(conds, " AND ");

    try {
      const [entries, countRows, summaryRows, accounts] = await Promise.all([
        // Join to cash_accounts for account_name; no users join (avoids column name guessing)
        adminPrisma.$queryRaw<LedgerEntryRow[]>`
          SELECT
            le.*,
            COALESCE(ca.name, '')         AS account_name,
            COALESCE(ca.account_type, '') AS account_type,
            NULL::text                    AS recorder_name
          FROM ledger_entries le
          LEFT JOIN cash_accounts ca ON ca.id = le.account_id
          WHERE ${where}
          ORDER BY le.entry_date DESC, le.created_at DESC
          LIMIT  ${params.limit}::int
          OFFSET ${skip}::int
        `,
        adminPrisma.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(*)::bigint AS count
          FROM ledger_entries le
          WHERE ${where}
        `,
        adminPrisma.$queryRaw<[{ total_incoming: bigint; total_outgoing: bigint }]>`
          SELECT
            COALESCE(SUM(CASE WHEN le.entry_type = 'INCOMING' THEN le.amount ELSE 0 END), 0)::bigint AS total_incoming,
            COALESCE(SUM(CASE WHEN le.entry_type = 'OUTGOING' THEN le.amount ELSE 0 END), 0)::bigint AS total_outgoing
          FROM ledger_entries le
          WHERE ${where}
        `,
        adminPrisma.$queryRaw<CashAccountRow[]>`
          SELECT * FROM cash_accounts
          WHERE hotel_id = ${hotelId}::uuid
          ORDER BY account_type ASC
        `,
      ]);

      const total    = Number(countRows[0]?.count ?? 0);
      const totalIn  = Number(summaryRows[0]?.total_incoming ?? 0);
      const totalOut = Number(summaryRows[0]?.total_outgoing ?? 0);

      return {
        data: entries,
        meta: paginationMeta(total, params.page, params.limit),
        summary: { totalIncoming: totalIn, totalOutgoing: totalOut, netFlow: totalIn - totalOut },
        accounts,
      };
    } catch (err) {
      console.error("[CashBook] getLedger SQL error:", err);
      // Return empty data rather than throwing, so account cards still load
      return {
        data:     [] as LedgerEntryRow[],
        meta:     paginationMeta(0, params.page, params.limit),
        summary:  { totalIncoming: 0, totalOutgoing: 0, netFlow: 0 },
        accounts: [] as CashAccountRow[],
      };
    }
  },

  async setOpeningBalance(hotelId: string, accountId: string, amount: number, actorId: string): Promise<LedgerEntryRow> {
    const [countRow] = await adminPrisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*)::bigint AS count FROM ledger_entries
      WHERE account_id = ${accountId}::uuid AND hotel_id = ${hotelId}::uuid
    `;
    if (Number(countRow.count) > 0) {
      throw new AppError(400, "Opening balance already set for this account");
    }

    return CashBookService.createEntry(
      hotelId,
      { accountId, entryType: "INCOMING", amount, description: "Opening Balance", sourceType: "OPENING_BALANCE" },
      actorId,
    );
  },
};

// ── Auto-entry helpers ────────────────────────────────────────────────────────

export async function createLedgerEntryFromPayment(
  hotelId: string,
  payment: { id: string; amount: number; method: string; reservationId: string },
  actorId: string,
): Promise<void> {
  try {
    const accountType = PAYMENT_METHOD_TO_ACCOUNT[payment.method] ?? "CASH_DRAWER";
    const account     = await CashBookService.getOrCreateAccount(hotelId, accountType, actorId);

    const reservation = await adminPrisma.reservation.findFirst({
      where:  { id: payment.reservationId },
      select: { confirmationNumber: true },
    });
    const ref = reservation?.confirmationNumber ?? payment.reservationId.slice(0, 8);

    await CashBookService.createEntry(
      hotelId,
      {
        accountId:     account.id,
        entryType:     "INCOMING",
        amount:        payment.amount,
        sourceType:    "FOLIO_PAYMENT",
        sourceId:      payment.id,
        description:   `Payment — ${ref}`,
        paymentMethod: payment.method,
      } as CreateEntryDto & { sourceId: string },
      actorId,
    );
  } catch (err) {
    console.error("[CashBook] createLedgerEntryFromPayment error:", payment.id, err);
  }
}

export async function createLedgerEntryFromPosOrder(
  hotelId: string,
  order: { id: string; orderNumber: string; total: number; paymentMethod: string },
  actorId: string,
): Promise<void> {
  try {
    const accountType = PAYMENT_METHOD_TO_ACCOUNT[order.paymentMethod] ?? "CASH_DRAWER";
    const account      = await CashBookService.getOrCreateAccount(hotelId, accountType, actorId);

    await CashBookService.createEntry(
      hotelId,
      {
        accountId:     account.id,
        entryType:     "INCOMING",
        amount:        order.total,
        sourceType:    "POS_SALE",
        sourceId:      order.id,
        description:   `POS Sale — ${order.orderNumber}`,
        paymentMethod: order.paymentMethod,
      } as CreateEntryDto & { sourceId: string },
      actorId,
    );
  } catch (err) {
    console.error("[CashBook] createLedgerEntryFromPosOrder error:", order.id, err);
  }
}

export async function createLedgerEntryFromExpense(
  hotelId: string,
  expense: { id: string; amount: number; paymentMethod: string; description: string; paidTo: string },
  actorId: string,
): Promise<void> {
  try {
    const accountType = EXPENSE_METHOD_TO_ACCOUNT[expense.paymentMethod] ?? "CASH_DRAWER";
    const account     = await CashBookService.getOrCreateAccount(hotelId, accountType, actorId);

    await CashBookService.createEntry(
      hotelId,
      {
        accountId:     account.id,
        entryType:     "OUTGOING",
        amount:        expense.amount,
        sourceType:    "EXPENSE",
        sourceId:      expense.id,
        description:   `${expense.description} — ${expense.paidTo}`,
        paymentMethod: expense.paymentMethod,
      } as CreateEntryDto & { sourceId: string },
      actorId,
    );
  } catch (err) {
    console.error("[CashBook] createLedgerEntryFromExpense error:", expense.id, err);
  }
}
