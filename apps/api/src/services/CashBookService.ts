/**
 * Balance Book over the deliberately raw-SQL cash_accounts/ledger_entries
 * tables. Schema changes belong in committed Prisma migration SQL; never use
 * prisma db push and never recreate these tables manually.
 */

import { adminPrisma, Prisma } from "@pms/db";
import { AppError } from "../utils/AppError";
import { paginationMeta } from "../utils/pagination";
import { notifyHotelDataChanged } from "../lib/realtime";
import type { AccountType, BalancesQuery, CreateAccountDto, CreateEntryDto, LedgerQuery, SummaryQuery, TransferDto } from "../schemas/cashbook";

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
  reversal_of_entry_id: string | null;
  transfer_group_id: string | null;
  // joined
  account_name:  string;
  account_type:  string;
  recorder_name: string | null;
}

type CashAccountDbRow = Omit<CashAccountRow, "balance"> & {
  balance: bigint | number;
};

type LedgerEntryDbRow = Omit<LedgerEntryRow, "amount" | "balance_after"> & {
  amount: bigint | number;
  balance_after: bigint | number;
};

function serializeCashAccount(row: CashAccountDbRow): CashAccountRow {
  return { ...row, balance: Number(row.balance) };
}

function serializeLedgerEntry(row: LedgerEntryDbRow): LedgerEntryRow {
  return {
    ...row,
    amount: Number(row.amount),
    balance_after: Number(row.balance_after),
  };
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

type InternalEntryDto = CreateEntryDto & {
  sourceId?: string;
  reversalOfEntryId?: string;
  transferGroupId?: string;
};

// ── Service ───────────────────────────────────────────────────────────────────

export const CashBookService = {

  async getAccounts(hotelId: string): Promise<CashAccountRow[]> {
    try {
      const rows = await adminPrisma.$queryRaw<CashAccountDbRow[]>`
        SELECT * FROM cash_accounts
        WHERE hotel_id = ${hotelId}::uuid
        ORDER BY account_type ASC, created_at ASC
      `;
      return rows.map(serializeCashAccount);
    } catch (err) {
      console.error("[CashBook] getAccounts error:", err);
      throw new AppError(500, "Failed to load cash accounts");
    }
  },

  async getOrCreateAccount(hotelId: string, accountType: AccountType, _actorId: string): Promise<CashAccountRow> {
    try {
      const row = await adminPrisma.$transaction(async (tx) => {
        // Keep one deterministic system account per hotel/account type without
        // making the posting path depend on a particular expression index.
        await tx.$queryRaw<[{ pg_advisory_xact_lock: null }]>`
          SELECT pg_advisory_xact_lock(
            hashtextextended(${`${hotelId}:${accountType}`}, 0)
          )
        `;
        const existing = await tx.$queryRaw<CashAccountDbRow[]>`
          SELECT * FROM cash_accounts
          WHERE hotel_id = ${hotelId}::uuid AND account_type = ${accountType}
          ORDER BY created_at ASC, id ASC
          LIMIT 1
        `;
        if (existing[0]) return existing[0];

        const created = await tx.$queryRaw<CashAccountDbRow[]>`
          INSERT INTO cash_accounts (hotel_id, name, account_type, balance)
          VALUES (${hotelId}::uuid, ${ACCOUNT_TYPE_LABELS[accountType]}, ${accountType}, 0)
          ON CONFLICT DO NOTHING
          RETURNING *
        `;
        if (created[0]) return created[0];

        const fallback = await tx.$queryRaw<CashAccountDbRow[]>`
          SELECT * FROM cash_accounts
          WHERE hotel_id = ${hotelId}::uuid
            AND lower(name) = lower(${ACCOUNT_TYPE_LABELS[accountType]})
          LIMIT 1
        `;
        if (!fallback[0]) throw new AppError(500, "Cash account creation returned no row");
        return fallback[0];
      });
      return serializeCashAccount(row);
    } catch (err) {
      console.error("[CashBook] getOrCreateAccount error:", err);
      throw new AppError(500, "Failed to get or create cash account");
    }
  },

  async createAccount(hotelId: string, dto: CreateAccountDto, _actorId: string): Promise<CashAccountRow> {
    try {
      const rows = await adminPrisma.$queryRaw<CashAccountDbRow[]>`
        INSERT INTO cash_accounts (hotel_id, name, account_type, balance)
        VALUES (${hotelId}::uuid, ${dto.name}, ${dto.accountType}, 0)
        RETURNING *
      `;
      if (!rows[0]) throw new AppError(500, "Insert returned no row");
      notifyHotelDataChanged(hotelId);
      return serializeCashAccount(rows[0]);
    } catch (err) {
      if (err instanceof AppError) throw err;
      console.error("[CashBook] createAccount SQL error:", err);
      throw new AppError(409, "An account with this name already exists");
    }
  },

  async createEntry(hotelId: string, dto: InternalEntryDto, actorId: string): Promise<LedgerEntryRow> {
    const resolvedAccountId = dto.accountId;

    // Use Intl to get current date in the hotel's timezone (PKT = Asia/Karachi, UTC+5).
    // Plain toISOString() returns UTC which gives yesterday's date before 05:00 local time.
    const today     = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(new Date());
    const entryDate = dto.entryDate ?? today;
    const sourceId  = dto.sourceId ?? null;

    try {
      return await adminPrisma.$transaction(async (tx) => {
        const [account] = await tx.$queryRaw<[{ id: string; hotel_id: string; balance: bigint }]>`
          SELECT id, hotel_id, balance FROM cash_accounts
          WHERE id = ${resolvedAccountId}::uuid AND hotel_id = ${hotelId}::uuid
          FOR UPDATE
        `;
        if (!account) throw new AppError(404, "Account not found");

        const inserted = await tx.$queryRaw<LedgerEntryDbRow[]>`
          INSERT INTO ledger_entries
            (hotel_id, account_id, entry_type, amount, balance_after,
             source_type, source_id, description, payment_method,
             entry_date, notes, recorded_by_id, reversal_of_entry_id, transfer_group_id)
          VALUES
            (${hotelId}::uuid,
             ${resolvedAccountId}::uuid,
             ${dto.entryType},
             ${dto.amount}::bigint,
             0,
             ${dto.sourceType},
             ${sourceId},
             ${dto.description},
             ${dto.paymentMethod ?? null},
             ${entryDate}::date,
             ${dto.notes ?? null},
             ${actorId}::uuid,
             ${dto.reversalOfEntryId ?? null}::uuid,
             ${dto.transferGroupId ?? null}::uuid)
          ON CONFLICT DO NOTHING
          RETURNING *,
            '' AS account_name,
            '' AS account_type,
            NULL::text AS recorder_name
        `;
        let entry = inserted[0];
        if (!entry && sourceId) {
          [entry] = await tx.$queryRaw<LedgerEntryDbRow[]>`
            SELECT le.*, ca.name AS account_name, ca.account_type, NULL::text AS recorder_name
            FROM ledger_entries le
            JOIN cash_accounts ca ON ca.id = le.account_id
            WHERE le.hotel_id = ${hotelId}::uuid
              AND le.source_type = ${dto.sourceType}
              AND le.source_id = ${sourceId}
              AND le.entry_type = ${dto.entryType}
            LIMIT 1
          `;
        }
        if (!entry) throw new AppError(409, "This Balance Book movement has already been recorded");

        await tx.$executeRaw`
          WITH running AS (
            SELECT id,
                   SUM(CASE WHEN entry_type = 'INCOMING' THEN amount ELSE -amount END)
                     OVER (ORDER BY entry_date, created_at, id) AS balance
            FROM ledger_entries
            WHERE hotel_id = ${hotelId}::uuid AND account_id = ${resolvedAccountId}::uuid
          )
          UPDATE ledger_entries le
          SET balance_after = running.balance
          FROM running
          WHERE le.id = running.id
        `;
        const [balanceRow] = await tx.$queryRaw<{ balance: bigint }[]>`
          SELECT COALESCE(SUM(CASE WHEN entry_type = 'INCOMING' THEN amount ELSE -amount END), 0)::bigint AS balance
          FROM ledger_entries
          WHERE hotel_id = ${hotelId}::uuid AND account_id = ${resolvedAccountId}::uuid
        `;
        await tx.$executeRaw`
          UPDATE cash_accounts SET balance = ${balanceRow.balance}::bigint, updated_at = now()
          WHERE id = ${resolvedAccountId}::uuid AND hotel_id = ${hotelId}::uuid
        `;
        const [current] = await tx.$queryRaw<LedgerEntryDbRow[]>`
          SELECT le.*, ca.name AS account_name, ca.account_type, NULL::text AS recorder_name
          FROM ledger_entries le JOIN cash_accounts ca ON ca.id = le.account_id
          WHERE le.id = ${entry.id}::uuid
        `;
        if (!current) throw new AppError(500, "Recorded Balance Book entry could not be reloaded");
        return current;
      }).then((entry) => {
        notifyHotelDataChanged(hotelId);
        return serializeLedgerEntry(entry);
      });
    } catch (err) {
      if (err instanceof AppError) throw err;
      console.error("[CashBook] createEntry SQL error:", err);
      throw new AppError(500, "Failed to record Balance Book entry");
    }
  },

  async createTransfer(hotelId: string, dto: TransferDto, actorId: string) {
    const entryDate = dto.entryDate
      ?? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(new Date());
    return adminPrisma.$transaction(async (tx) => {
      const accounts = await tx.$queryRaw<{ id: string; balance: bigint }[]>`
        SELECT id, balance FROM cash_accounts
        WHERE hotel_id = ${hotelId}::uuid
          AND id IN (${dto.fromAccountId}::uuid, ${dto.toAccountId}::uuid)
        ORDER BY id FOR UPDATE
      `;
      if (accounts.length !== 2) throw new AppError(404, "One or both Balance Book accounts were not found");
      const source = accounts.find((account) => account.id === dto.fromAccountId);
      if (!source || Number(source.balance) < dto.amount) {
        throw new AppError(400, "The source account does not have enough balance for this transfer");
      }
      const [group] = await tx.$queryRaw<{ id: string }[]>`SELECT gen_random_uuid() AS id`;

      const entries = await tx.$queryRaw<LedgerEntryDbRow[]>`
        INSERT INTO ledger_entries
          (hotel_id, account_id, entry_type, amount, balance_after, source_type,
           description, entry_date, notes, recorded_by_id, transfer_group_id)
        VALUES
          (${hotelId}::uuid, ${dto.fromAccountId}::uuid, 'OUTGOING', ${dto.amount}::bigint, 0,
           'ACCOUNT_TRANSFER', ${dto.description}, ${entryDate}::date, ${dto.notes ?? null}, ${actorId}::uuid, ${group.id}::uuid),
          (${hotelId}::uuid, ${dto.toAccountId}::uuid, 'INCOMING', ${dto.amount}::bigint, 0,
           'ACCOUNT_TRANSFER', ${dto.description}, ${entryDate}::date, ${dto.notes ?? null}, ${actorId}::uuid, ${group.id}::uuid)
        RETURNING *, '' AS account_name, '' AS account_type, NULL::text AS recorder_name
      `;

      await tx.$executeRaw`
        WITH running AS (
          SELECT id, account_id,
                 SUM(CASE WHEN entry_type = 'INCOMING' THEN amount ELSE -amount END)
                   OVER (PARTITION BY account_id ORDER BY entry_date, created_at, id) AS balance
          FROM ledger_entries
          WHERE hotel_id = ${hotelId}::uuid
            AND account_id IN (${dto.fromAccountId}::uuid, ${dto.toAccountId}::uuid)
        )
        UPDATE ledger_entries le SET balance_after = running.balance
        FROM running WHERE le.id = running.id
      `;
      await tx.$executeRaw`
        UPDATE cash_accounts ca SET balance = COALESCE((
          SELECT SUM(CASE WHEN le.entry_type = 'INCOMING' THEN le.amount ELSE -le.amount END)
          FROM ledger_entries le WHERE le.hotel_id = ca.hotel_id AND le.account_id = ca.id
        ), 0), updated_at = now()
        WHERE ca.hotel_id = ${hotelId}::uuid
          AND ca.id IN (${dto.fromAccountId}::uuid, ${dto.toAccountId}::uuid)
      `;
      const outgoing = entries.find((entry) => entry.entry_type === "OUTGOING");
      const incoming = entries.find((entry) => entry.entry_type === "INCOMING");
      return {
        transferGroupId: group.id,
        outgoing: outgoing ? serializeLedgerEntry(outgoing) : undefined,
        incoming: incoming ? serializeLedgerEntry(incoming) : undefined,
      };
    }).then((result) => { notifyHotelDataChanged(hotelId); return result; });
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
      throw new AppError(500, "Failed to load Balance Book summary");
    }
  },

  async getBalances(hotelId: string, params: BalancesQuery) {
    const asOf = params.asOf ?? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(new Date());
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
            SELECT SUM(CASE WHEN le.entry_type = 'INCOMING' THEN le.amount ELSE -le.amount END)
            FROM ledger_entries le
            WHERE le.account_id = ca.id AND le.hotel_id = ca.hotel_id
              AND le.entry_date <= ${asOf}::date
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
      throw new AppError(500, "Failed to load Balance Book account balances");
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
        adminPrisma.$queryRaw<LedgerEntryDbRow[]>`
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
        adminPrisma.$queryRaw<CashAccountDbRow[]>`
          SELECT * FROM cash_accounts
          WHERE hotel_id = ${hotelId}::uuid
          ORDER BY account_type ASC
        `,
      ]);

      const total    = Number(countRows[0]?.count ?? 0);
      const totalIn  = Number(summaryRows[0]?.total_incoming ?? 0);
      const totalOut = Number(summaryRows[0]?.total_outgoing ?? 0);

      return {
        data: entries.map(serializeLedgerEntry),
        meta: paginationMeta(total, params.page, params.limit),
        summary: { totalIncoming: totalIn, totalOutgoing: totalOut, netFlow: totalIn - totalOut },
        accounts: accounts.map(serializeCashAccount),
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[CashBook] getLedger SQL error:", msg);
      // Surface as a proper API error rather than silently returning empty data —
      // silent empty results made it impossible to tell whether the cashbook tables
      // were missing vs genuinely empty.
      throw new AppError(500, "Balance Book query failed");
    }
  },

  async exportLedger(hotelId: string, params: Omit<LedgerQuery, "page" | "limit">) {
    const conds: Prisma.Sql[] = [Prisma.sql`le.hotel_id = ${hotelId}::uuid`];
    if (params.accountId)  conds.push(Prisma.sql`le.account_id = ${params.accountId}::uuid`);
    if (params.startDate)  conds.push(Prisma.sql`le.entry_date >= ${params.startDate}::date`);
    if (params.endDate)    conds.push(Prisma.sql`le.entry_date <= ${params.endDate}::date`);
    if (params.entryType)  conds.push(Prisma.sql`le.entry_type = ${params.entryType}`);
    if (params.sourceType) conds.push(Prisma.sql`le.source_type = ${params.sourceType}`);
    const where = Prisma.join(conds, " AND ");

    const [entries, totals] = await Promise.all([
      adminPrisma.$queryRaw<LedgerEntryDbRow[]>`
        SELECT le.*, ca.name AS account_name, ca.account_type, NULL::text AS recorder_name
        FROM ledger_entries le
        JOIN cash_accounts ca ON ca.id = le.account_id
        WHERE ${where}
        ORDER BY le.entry_date DESC, le.created_at DESC
      `,
      adminPrisma.$queryRaw<[{ total_incoming: bigint; total_outgoing: bigint }]>`
        SELECT
          COALESCE(SUM(CASE WHEN le.entry_type = 'INCOMING' THEN le.amount ELSE 0 END), 0)::bigint AS total_incoming,
          COALESCE(SUM(CASE WHEN le.entry_type = 'OUTGOING' THEN le.amount ELSE 0 END), 0)::bigint AS total_outgoing
        FROM ledger_entries le WHERE ${where}
      `,
    ]);
    const totalIncoming = Number(totals[0]?.total_incoming ?? 0);
    const totalOutgoing = Number(totals[0]?.total_outgoing ?? 0);
    return {
      entries: entries.map(serializeLedgerEntry),
      summary: { totalIncoming, totalOutgoing, netFlow: totalIncoming - totalOutgoing },
    };
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
  payment: { id: string; amount: number; method: string; reservationId: string; entryDate?: string },
  actorId: string,
): Promise<void> {
  try {
    // These settle a folio without representing new money entering the hotel.
    // ADVANCE_DEPOSIT was collected earlier; OTA_COLLECT is a receivable;
    // COMPLIMENTARY is not money at all.
    if (["ADVANCE_DEPOSIT", "OTA_COLLECT", "COMPLIMENTARY"].includes(payment.method)) return;
    const accountType = PAYMENT_METHOD_TO_ACCOUNT[payment.method];
    if (!accountType) throw new AppError(400, `Unsupported payment method: ${payment.method}`);
    const account     = await CashBookService.getOrCreateAccount(hotelId, accountType, actorId);

    const reservation = await adminPrisma.reservation.findFirst({
      where:  { id: payment.reservationId, hotelId },
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
        entryDate:     payment.entryDate,
      } as CreateEntryDto & { sourceId: string },
      actorId,
    );
  } catch (err) {
    console.error("[CashBook] createLedgerEntryFromPayment error:", payment.id, err);
    throw err;
  }
}

export async function createLedgerEntryFromRefund(
  hotelId: string,
  refund: { id: string; amount: number; method: string; reservationId: string; entryDate?: string },
  actorId: string,
): Promise<void> {
  try {
    if (["ADVANCE_DEPOSIT", "OTA_COLLECT", "COMPLIMENTARY"].includes(refund.method)) return;
    const accountType = PAYMENT_METHOD_TO_ACCOUNT[refund.method];
    if (!accountType) throw new AppError(400, `Unsupported refund method: ${refund.method}`);
    const account = await CashBookService.getOrCreateAccount(hotelId, accountType, actorId);
    await CashBookService.createEntry(hotelId, {
      accountId: account.id, entryType: "OUTGOING", amount: refund.amount,
      sourceType: "PAYMENT_REFUND", sourceId: refund.id,
      description: `Payment refund — ${refund.reservationId.slice(0, 8)}`,
      paymentMethod: refund.method,
      entryDate: refund.entryDate,
    }, actorId);
  } catch (err) {
    console.error("[CashBook] createLedgerEntryFromRefund error:", refund.id, err);
    throw err;
  }
}

export async function createLedgerEntryFromCompanyMovement(
  hotelId: string,
  movement: {
    id: string; companyName: string; amount: number; method: string;
    direction: "INCOMING" | "OUTGOING"; entryDate?: string;
  },
  actorId: string,
): Promise<void> {
  try {
    const accountType = PAYMENT_METHOD_TO_ACCOUNT[movement.method];
    if (!accountType) throw new AppError(400, `Unsupported company payment method: ${movement.method}`);
    const account = await CashBookService.getOrCreateAccount(hotelId, accountType, actorId);
    await CashBookService.createEntry(hotelId, {
      accountId: account.id,
      entryType: movement.direction,
      amount: movement.amount,
      sourceType: movement.direction === "INCOMING" ? "COMPANY_PAYMENT" : "COMPANY_CREDIT_REFUND",
      sourceId: movement.id,
      description: `${movement.direction === "INCOMING" ? "Company payment" : "Company credit refund"} — ${movement.companyName}`,
      paymentMethod: movement.method,
      entryDate: movement.entryDate,
    }, actorId);
  } catch (err) {
    console.error("[CashBook] createLedgerEntryFromCompanyMovement error:", movement.id, err);
    throw err;
  }
}

export async function createLedgerEntryFromPosOrder(
  hotelId: string,
  order: { id: string; orderNumber: string; total: number; paymentMethod: string; entryDate?: string },
  actorId: string,
): Promise<void> {
  try {
    const accountType = PAYMENT_METHOD_TO_ACCOUNT[order.paymentMethod];
    if (!accountType) throw new AppError(400, `Unsupported POS payment method: ${order.paymentMethod}`);
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
        entryDate:     order.entryDate,
      } as CreateEntryDto & { sourceId: string },
      actorId,
    );
  } catch (err) {
    console.error("[CashBook] createLedgerEntryFromPosOrder error:", order.id, err);
    throw err;
  }
}

export async function createLedgerEntryFromQrOrder(
  hotelId: string,
  order: { id: string; orderNumber: string; total: number; paymentMethod: string; entryDate?: string },
  actorId: string,
): Promise<void> {
  try {
    const accountType = PAYMENT_METHOD_TO_ACCOUNT[order.paymentMethod];
    if (!accountType) throw new AppError(400, `Unsupported QR payment method: ${order.paymentMethod}`);
    const account      = await CashBookService.getOrCreateAccount(hotelId, accountType, actorId);

    await CashBookService.createEntry(
      hotelId,
      {
        accountId:     account.id,
        entryType:     "INCOMING",
        amount:        order.total,
        sourceType:    "QR_ORDER_SALE",
        sourceId:      order.id,
        description:   `QR Order — ${order.orderNumber}`,
        paymentMethod: order.paymentMethod,
        entryDate:     order.entryDate,
      } as CreateEntryDto & { sourceId: string },
      actorId,
    );
  } catch (err) {
    console.error("[CashBook] createLedgerEntryFromQrOrder error:", order.id, err);
    throw err;
  }
}

export async function createLedgerEntryFromExpense(
  hotelId: string,
  expense: { id: string; amount: number; paymentMethod: string; description: string; paidTo: string; entryDate?: string },
  actorId: string,
): Promise<void> {
  try {
    const accountType = EXPENSE_METHOD_TO_ACCOUNT[expense.paymentMethod];
    if (!accountType) throw new AppError(400, `Unsupported expense payment method: ${expense.paymentMethod}`);
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
        entryDate:     expense.entryDate,
      } as CreateEntryDto & { sourceId: string },
      actorId,
    );
  } catch (err) {
    console.error("[CashBook] createLedgerEntryFromExpense error:", expense.id, err);
    throw err;
  }
}

/**
 * Repair any automatic source movement that was missed after its primary
 * transaction succeeded. Safe to run repeatedly because automatic source
 * movements are protected by a unique source/direction index.
 */
export async function reconcileCashBook(hotelId: string, actorId: string) {
  const dateOf = (value: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(value);
  const [payments, expenses, posOrders, qrOrders, companyPayments, companyOutflows] = await Promise.all([
    adminPrisma.$queryRaw<Array<{ id: string; amount: number; method: string; reservation_id: string | null; is_refund: boolean; posted_at: Date }>>`
      SELECT p.id, p.amount, p.method::text, p.reservation_id, p.is_refund, p.posted_at
      FROM payments p
      WHERE p.hotel_id = ${hotelId}::uuid AND p.status = 'COMPLETED'
        AND p.method::text NOT IN ('ADVANCE_DEPOSIT', 'OTA_COLLECT', 'COMPLIMENTARY')
        AND NOT EXISTS (
          SELECT 1 FROM ledger_entries le
          WHERE le.hotel_id = p.hotel_id AND le.source_id = p.id::text
            AND le.source_type = CASE WHEN p.is_refund THEN 'PAYMENT_REFUND' ELSE 'FOLIO_PAYMENT' END
            AND le.entry_type = CASE WHEN p.is_refund THEN 'OUTGOING' ELSE 'INCOMING' END
        )
    `,
    adminPrisma.$queryRaw<Array<{ id: string; amount: number; payment_method: string; description: string; paid_to: string; date: Date }>>`
      SELECT id, amount, payment_method, description, paid_to, date
      FROM expenses e WHERE e.hotel_id = ${hotelId}::uuid
        AND NOT EXISTS (
          SELECT 1 FROM ledger_entries le WHERE le.hotel_id = e.hotel_id
            AND le.source_type = 'EXPENSE' AND le.source_id = e.id::text AND le.entry_type = 'OUTGOING'
        )
    `,
    adminPrisma.$queryRaw<Array<{ id: string; order_number: string; total: number; table_number: string; created_at: Date }>>`
      SELECT id, order_number, total, table_number, created_at
      FROM pos_orders po
      WHERE po.hotel_id = ${hotelId}::uuid AND po.is_posted_to_folio = false AND po.table_number LIKE 'PAID:%'
        AND NOT EXISTS (
          SELECT 1 FROM ledger_entries le WHERE le.hotel_id = po.hotel_id
            AND le.source_type = 'POS_SALE' AND le.source_id = po.id::text AND le.entry_type = 'INCOMING'
        )
    `,
    adminPrisma.$queryRaw<Array<{ id: string; order_number: string; total_amount: bigint; payment_method: string; updated_at: Date }>>`
      SELECT id, order_number, total_amount, payment_method, updated_at
      FROM qr_orders qo
      WHERE qo.hotel_id = ${hotelId}::uuid AND qo.status = 'delivered'
        AND qo.payment_preference = 'pay_now' AND qo.payment_method IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM ledger_entries le WHERE le.hotel_id = qo.hotel_id
            AND le.source_type = 'QR_ORDER_SALE' AND le.source_id = qo.id::text AND le.entry_type = 'INCOMING'
        )
    `,
    adminPrisma.$queryRaw<Array<{ id: string; amount: bigint; payment_method: string; entry_date: Date; company_name: string }>>`
      SELECT cle.id, cle.amount, cle.payment_method::text, cle.entry_date, c.name AS company_name
      FROM company_ledger_entries cle
      JOIN companies c ON c.id = cle.company_id
      WHERE cle.hotel_id = ${hotelId}::uuid AND cle.type = 'PAYMENT' AND cle.reversed_at IS NULL
        AND cle.payment_method IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM ledger_entries le WHERE le.hotel_id = cle.hotel_id
            AND le.source_type = 'COMPANY_PAYMENT' AND le.source_id = cle.id::text AND le.entry_type = 'INCOMING'
        )
    `,
    adminPrisma.$queryRaw<Array<{ id: string; amount: bigint; payment_method: string; movement_date: Date; company_name: string }>>`
      SELECT cle.id, cle.amount, cle.payment_method::text,
             CASE WHEN cle.type = 'PAYMENT' THEN cle.reversed_at ELSE cle.entry_date END AS movement_date,
             c.name AS company_name
      FROM company_ledger_entries cle
      JOIN companies c ON c.id = cle.company_id
      WHERE cle.hotel_id = ${hotelId}::uuid
        AND ((cle.type = 'CREDIT_REFUND' AND cle.reversed_at IS NULL)
          OR (cle.type = 'PAYMENT' AND cle.reversed_at IS NOT NULL))
        AND cle.payment_method IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM ledger_entries le WHERE le.hotel_id = cle.hotel_id
            AND le.source_type = 'COMPANY_CREDIT_REFUND' AND le.source_id = cle.id::text AND le.entry_type = 'OUTGOING'
        )
    `,
  ]);

  let repaired = 0;
  const run = async (operation: () => Promise<void>) => {
    const before = repaired;
    try { await operation(); repaired += 1; } catch (error) {
      console.error("[CashBook] reconciliation item failed:", error);
    }
    return repaired > before;
  };

  for (const payment of payments) {
    if (!payment.reservation_id) continue;
    await run(() => payment.is_refund
      ? createLedgerEntryFromRefund(hotelId, { id: payment.id, amount: payment.amount, method: payment.method, reservationId: payment.reservation_id!, entryDate: dateOf(payment.posted_at) }, actorId)
      : createLedgerEntryFromPayment(hotelId, { id: payment.id, amount: payment.amount, method: payment.method, reservationId: payment.reservation_id!, entryDate: dateOf(payment.posted_at) }, actorId));
  }
  for (const expense of expenses) {
    await run(() => createLedgerEntryFromExpense(hotelId, {
      id: expense.id, amount: expense.amount, paymentMethod: expense.payment_method,
      description: expense.description, paidTo: expense.paid_to, entryDate: dateOf(expense.date),
    }, actorId));
  }
  for (const order of posOrders) {
    await run(() => createLedgerEntryFromPosOrder(hotelId, {
      id: order.id, orderNumber: order.order_number, total: order.total,
      paymentMethod: order.table_number.slice(5), entryDate: dateOf(order.created_at),
    }, actorId));
  }
  for (const order of qrOrders) {
    await run(() => createLedgerEntryFromQrOrder(hotelId, {
      id: order.id, orderNumber: order.order_number, total: Number(order.total_amount),
      paymentMethod: order.payment_method, entryDate: dateOf(order.updated_at),
    }, actorId));
  }
  for (const payment of companyPayments) {
    await run(() => createLedgerEntryFromCompanyMovement(hotelId, {
      id: payment.id, companyName: payment.company_name, amount: Number(payment.amount),
      method: payment.payment_method, direction: "INCOMING", entryDate: dateOf(payment.entry_date),
    }, actorId));
  }
  for (const movement of companyOutflows) {
    await run(() => createLedgerEntryFromCompanyMovement(hotelId, {
      id: movement.id, companyName: movement.company_name, amount: Number(movement.amount),
      method: movement.payment_method, direction: "OUTGOING", entryDate: dateOf(movement.movement_date),
    }, actorId));
  }
  return {
    scanned: payments.length + expenses.length + posOrders.length + qrOrders.length
      + companyPayments.length + companyOutflows.length,
    repaired,
  };
}

export async function voidLedgerEntryFromExpense(
  hotelId: string,
  expenseId: string,
  actorId: string,
): Promise<void> {
  try {
    const rows = await adminPrisma.$queryRaw<
      { id: string; amount: bigint; account_id: string; payment_method: string | null; description: string }[]
    >`
      SELECT id, amount, account_id, payment_method, description
      FROM ledger_entries
      WHERE hotel_id    = ${hotelId}::uuid
        AND source_type = 'EXPENSE'
        AND source_id   = ${expenseId}
        AND entry_type  = 'OUTGOING'
      LIMIT 1
    `;
    if (rows.length === 0) return;

    const original = rows[0];
    await CashBookService.createEntry(
      hotelId,
      {
        accountId:     original.account_id,
        entryType:     "INCOMING",
        amount:        Number(original.amount),
        sourceType:    "EXPENSE",
        sourceId:      expenseId,
        description:   `Void: ${original.description}`,
        paymentMethod: original.payment_method ?? undefined,
        reversalOfEntryId: original.id,
      },
      actorId,
    );
  } catch (err) {
    console.error("[CashBook] voidLedgerEntryFromExpense error:", expenseId, err);
    throw err;
  }
}
