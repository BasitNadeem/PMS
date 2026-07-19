/**
 * ExpenseService — uses adminPrisma.$queryRaw / $executeRaw
 * because the `expenses` table is NOT in the Prisma schema.
 *
 * Requires manual migration before first use:
 *   CREATE TABLE expenses (
 *     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *     hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
 *     date DATE NOT NULL,
 *     category VARCHAR(50) NOT NULL,
 *     description TEXT NOT NULL,
 *     amount INTEGER NOT NULL,
 *     payment_method VARCHAR(50) NOT NULL,
 *     paid_to VARCHAR(255) NOT NULL,
 *     receipt_ref VARCHAR(255),
 *     notes TEXT,
 *     created_by_id UUID NOT NULL REFERENCES users(id),
 *     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 *     updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
 *   );
 */

import { adminPrisma, Prisma } from "@pms/db";
import { AppError } from "../utils/AppError";
import { paginationMeta } from "../utils/pagination";
import type { CreateExpenseDto, UpdateExpenseDto, ListExpensesQuery } from "../schemas/expenses";
import { createLedgerEntryFromExpense, voidLedgerEntryFromExpense } from "./CashBookService";

export interface ExpenseRow {
  id:             string;
  hotel_id:       string;
  date:           Date;
  category:       string;
  description:    string;
  amount:         number;
  payment_method: string;
  paid_to:        string;
  receipt_ref:    string | null;
  notes:          string | null;
  attachment_url: string | null;
  created_by_id:  string;
  created_at:     Date;
  updated_at:     Date;
}

function buildConditions(hotelId: string, params: Partial<ListExpensesQuery> & { startDate?: string; endDate?: string }): Prisma.Sql[] {
  const conds: Prisma.Sql[] = [Prisma.sql`hotel_id = ${hotelId}::uuid`];
  if (params.category)  conds.push(Prisma.sql`category = ${params.category}`);
  if (params.startDate) conds.push(Prisma.sql`date >= ${params.startDate}::date`);
  if (params.endDate)   conds.push(Prisma.sql`date <= ${params.endDate}::date`);
  return conds;
}

export const ExpenseService = {
  async listExpenses(hotelId: string, params: ListExpensesQuery) {
    const skip  = (params.page - 1) * params.limit;
    const conds = buildConditions(hotelId, params);
    const where = Prisma.join(conds, " AND ");

    const [rows, countRows] = await Promise.all([
      adminPrisma.$queryRaw<ExpenseRow[]>`
        SELECT * FROM expenses WHERE ${where}
        ORDER BY date DESC, created_at DESC
        LIMIT ${params.limit}::int OFFSET ${skip}::int
      `,
      adminPrisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*)::bigint AS count FROM expenses WHERE ${where}
      `,
    ]);

    const total = Number(countRows[0]?.count ?? 0);
    return {
      data: rows,
      meta: paginationMeta(total, params.page, params.limit),
    };
  },

  async getExpense(hotelId: string, id: string) {
    const rows = await adminPrisma.$queryRaw<ExpenseRow[]>`
      SELECT * FROM expenses WHERE id = ${id}::uuid AND hotel_id = ${hotelId}::uuid LIMIT 1
    `;
    if (rows.length === 0) throw new AppError(404, "Expense not found");
    return rows[0];
  },

  async createExpense(hotelId: string, dto: CreateExpenseDto, actorId: string) {
    const rows = await adminPrisma.$queryRaw<ExpenseRow[]>`
      INSERT INTO expenses
        (hotel_id, date, category, description, amount, payment_method, paid_to,
         receipt_ref, notes, attachment_url, created_by_id, created_at, updated_at)
      VALUES
        (${hotelId}::uuid, ${dto.date}::date, ${dto.category}, ${dto.description},
         ${dto.amount}::int, ${dto.paymentMethod}, ${dto.paidTo},
         ${dto.receiptRef ?? null}, ${dto.notes ?? null}, ${dto.attachmentUrl ?? null},
         ${actorId}::uuid, now(), now())
      RETURNING *
    `;
    const expense = rows[0];

    // Auto-entry in cash book — fire-and-forget, never fails the expense
    createLedgerEntryFromExpense(
      hotelId,
      { id: expense.id, amount: expense.amount, paymentMethod: expense.payment_method, description: expense.description, paidTo: expense.paid_to },
      actorId,
    ).catch(() => { /* already logged inside */ });

    return expense;
  },

  async updateExpense(hotelId: string, id: string, dto: UpdateExpenseDto, actorId: string, actorRole: string) {
    const existing = await this.getExpense(hotelId, id);
    if (existing.created_by_id !== actorId && !["OWNER", "MANAGER"].includes(actorRole)) {
      throw new AppError(403, "Only the creator or a manager can update this expense");
    }

    // Build SET clause dynamically
    const sets: Prisma.Sql[] = [];
    if (dto.date          !== undefined) sets.push(Prisma.sql`date           = ${dto.date}::date`);
    if (dto.category      !== undefined) sets.push(Prisma.sql`category       = ${dto.category}`);
    if (dto.description   !== undefined) sets.push(Prisma.sql`description    = ${dto.description}`);
    if (dto.amount        !== undefined) sets.push(Prisma.sql`amount         = ${dto.amount}::int`);
    if (dto.paymentMethod !== undefined) sets.push(Prisma.sql`payment_method = ${dto.paymentMethod}`);
    if (dto.paidTo        !== undefined) sets.push(Prisma.sql`paid_to        = ${dto.paidTo}`);
    if (dto.receiptRef    !== undefined) sets.push(Prisma.sql`receipt_ref    = ${dto.receiptRef ?? null}`);
    if (dto.notes         !== undefined) sets.push(Prisma.sql`notes          = ${dto.notes ?? null}`);
    if (dto.attachmentUrl !== undefined) sets.push(Prisma.sql`attachment_url = ${dto.attachmentUrl ?? null}`);
    sets.push(Prisma.sql`updated_at = now()`);

    const setClause = Prisma.join(sets, ", ");
    const rows = await adminPrisma.$queryRaw<ExpenseRow[]>`
      UPDATE expenses SET ${setClause}
      WHERE id = ${id}::uuid AND hotel_id = ${hotelId}::uuid
      RETURNING *
    `;
    return rows[0];
  },

  async deleteExpense(hotelId: string, id: string, actorId: string, actorRole: string) {
    await this.getExpense(hotelId, id); // 404 if not found
    if (!["OWNER", "MANAGER"].includes(actorRole)) {
      throw new AppError(403, "Only owners and managers can delete expenses");
    }
    // Reverse the cash book entry before deleting so the ledger stays balanced
    await voidLedgerEntryFromExpense(hotelId, id, actorId);
    await adminPrisma.$executeRaw`
      DELETE FROM expenses WHERE id = ${id}::uuid AND hotel_id = ${hotelId}::uuid
    `;
  },

  async getSummary(hotelId: string, startDate: string, endDate: string) {
    const [totalRows, catRows] = await Promise.all([
      adminPrisma.$queryRaw<[{ total: bigint }]>`
        SELECT COALESCE(SUM(amount), 0)::bigint AS total
        FROM expenses
        WHERE hotel_id = ${hotelId}::uuid
          AND date >= ${startDate}::date
          AND date <= ${endDate}::date
      `,
      adminPrisma.$queryRaw<{ category: string; total: bigint; count: bigint }[]>`
        SELECT category,
               COALESCE(SUM(amount), 0)::bigint AS total,
               COUNT(*)::bigint                 AS count
        FROM expenses
        WHERE hotel_id = ${hotelId}::uuid
          AND date >= ${startDate}::date
          AND date <= ${endDate}::date
        GROUP BY category
        ORDER BY total DESC
      `,
    ]);

    const totalAmount = Number(totalRows[0]?.total ?? 0);
    const byCategory = catRows.map((r) => ({
      category: r.category,
      total:    Number(r.total),
      count:    Number(r.count),
    }));

    return { totalAmount, byCategory };
  },
};
