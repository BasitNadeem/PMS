import {
  Prisma,
  CompanyLedgerEntryType,
  CompanyInvoiceStatus,
  type CompanyPaymentTerms,
  type TenantTx,
} from "@pms/db";
import type { JwtPayload } from "../middleware/auth";
import { AppError } from "../utils/AppError";
import { paginationMeta } from "../utils/pagination";
import { notifyHotelDataChanged } from "../lib/realtime";
import {
  dueDateFor, summariseAging, allocatePayment, checkCreditLimit, outstandingOf,
  type CompanyPaymentTermsKey, type OpenCharge, type AgingSummary,
} from "../utils/companyCredit";
import type {
  ListCompaniesQuery, CreateCompanyDto, UpdateCompanyDto, SetCreditLimitDto,
  CompanyLedgerQuery, RecordCompanyPaymentDto, AdjustCompanyLedgerDto,
  CreateCompanyInvoiceDto, AgingReportQuery, ReverseCompanyPaymentDto,
  RefundCompanyCreditDto,
} from "../schemas/companies";
import { createLedgerEntryFromCompanyMovement } from "./CashBookService";
import { sendEmail } from "./EmailService";

type WithTenantFn = <T>(fn: (db: TenantTx) => Promise<T>) => Promise<T>;

// Fails to compile if the Prisma enum and the pure util's string union drift
// apart — e.g. if someone adds NET_120 to the schema without teaching
// companyCredit.ts how many days that is.
const _termsAreExhaustive: Record<CompanyPaymentTerms, CompanyPaymentTermsKey> = {
  IMMEDIATE: "IMMEDIATE",
  NET_7: "NET_7", NET_15: "NET_15", NET_30: "NET_30",
  NET_45: "NET_45", NET_60: "NET_60", NET_90: "NET_90",
};
void _termsAreExhaustive;

const COMPANY_SELECT = {
  id: true, name: true, type: true, code: true,
  contactName: true, contactPhone: true, contactEmail: true,
  address: true, city: true, ntn: true, strn: true,
  creditLimit: true, paymentTerms: true, balance: true,
  ratePlanId: true, discountPercent: true,
  isActive: true, notes: true, createdAt: true, updatedAt: true,
} satisfies Prisma.CompanySelect;

const minor = (value: bigint | number): number => Number(value);
const companyJson = <T extends { creditLimit: bigint; balance: bigint }>(company: T) => ({
  ...company,
  creditLimit: minor(company.creditLimit),
  balance: minor(company.balance),
});
const ledgerJson = <T extends { amount: bigint; settledAmount: bigint }>(entry: T) => ({
  ...entry,
  amount: minor(entry.amount),
  settledAmount: minor(entry.settledAmount),
});
const invoiceJson = <T extends { subtotal: bigint; taxAmount: bigint; totalAmount: bigint; paidAmount: bigint }>(invoice: T) => ({
  ...invoice,
  subtotal: minor(invoice.subtotal), taxAmount: minor(invoice.taxAmount),
  totalAmount: minor(invoice.totalAmount), paidAmount: minor(invoice.paidAmount),
});
const escapeHtml = (value: string | number) => String(value)
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const formatPkr = (paisa: bigint | number) => new Intl.NumberFormat("en-PK", {
  style: "currency", currency: "PKR", maximumFractionDigits: 0,
}).format(minor(paisa) / 100);

function startOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function parseDateOrToday(iso?: string): Date {
  return iso ? new Date(`${iso}T00:00:00.000Z`) : startOfUtcDay(new Date());
}

/**
 * Row types that increase what a company owes and can therefore be settled.
 * ADJUSTMENT belongs here alongside CHARGE — a late fee is debt like any
 * other, and leaving it out meant payments never cleared it and the aging
 * report kept chasing money that had already been paid.
 */
const OBLIGATION_TYPES: CompanyLedgerEntryType[] = [CompanyLedgerEntryType.CHARGE, CompanyLedgerEntryType.ADJUSTMENT];
const DEBIT_TYPES: CompanyLedgerEntryType[] = [...OBLIGATION_TYPES, CompanyLedgerEntryType.CREDIT_REFUND];
const CREDIT_TYPES: CompanyLedgerEntryType[] = [CompanyLedgerEntryType.PAYMENT, CompanyLedgerEntryType.WRITE_OFF];

/**
 * Every debit on a company that still has an unpaid remainder, oldest-first.
 *
 * Never paginated — allocating a payment against only the first page would
 * silently leave older debt unsettled.
 */
async function loadOpenCharges(db: TenantTx, companyId: string): Promise<OpenCharge[]> {
  const rows = await db.companyLedgerEntry.findMany({
    where: {
      companyId,
      reversedAt: null,
      type: { in: OBLIGATION_TYPES },
      // Prisma cannot compare two columns in a where clause, so filter the
      // fully-settled rows out in memory below rather than in SQL.
    },
    select: { id: true, amount: true, settledAmount: true, dueDate: true, entryDate: true },
    orderBy: [{ dueDate: "asc" }, { entryDate: "asc" }],
  });
  return rows
    .map((r) => ({ ...r, amount: minor(r.amount), settledAmount: minor(r.settledAmount) }))
    .filter((r) => outstandingOf(r) > 0);
}

async function requireCompany(db: TenantTx, id: string) {
  const company = await db.company.findFirst({
    where: { id, deletedAt: null },
    select: COMPANY_SELECT,
  });
  if (!company) throw new AppError(404, "Company not found");
  return company;
}

export interface CompanyPosition {
  /** What the company owes, never negative. */
  balance: number;
  /** Money received beyond what was owed — the hotel owes this back. */
  unappliedCredit: number;
}

/**
 * Re-derive every charge's settled amount and the company's balance from the
 * ledger, from scratch.
 *
 * Full recompute rather than incremental adjustment, for three reasons:
 *
 *  - Idempotency. A retried checkout or a double-submitted payment form cannot
 *    drift the balance away from the ledger the way `balance += amount` would.
 *  - Carry-forward. An overpayment leaves credit sitting on the account; when
 *    the next charge arrives it must be settled from that credit automatically,
 *    which per-payment allocation alone can never do because the charge did not
 *    exist when the payment was recorded.
 *  - Self-healing. Any historical drift is corrected the next time the company
 *    is touched.
 */
async function reconcileCompany(db: TenantTx, companyId: string): Promise<CompanyPosition> {
  const [obligations, creditAgg, refundAgg] = await Promise.all([
    db.companyLedgerEntry.findMany({
      where:   { companyId, type: { in: OBLIGATION_TYPES }, reversedAt: null },
      select:  { id: true, amount: true, settledAmount: true, dueDate: true, entryDate: true },
      orderBy: [{ dueDate: "asc" }, { entryDate: "asc" }],
    }),
    db.companyLedgerEntry.aggregate({
      where: { companyId, type: { in: CREDIT_TYPES }, reversedAt: null },
      _sum:  { amount: true },
    }),
    db.companyLedgerEntry.aggregate({
      where: { companyId, type: CompanyLedgerEntryType.CREDIT_REFUND, reversedAt: null },
      _sum:  { amount: true },
    }),
  ]);

  const totalCredit = Math.max(0, minor(creditAgg._sum.amount ?? 0n) - minor(refundAgg._sum.amount ?? 0n));
  const numericDebits = obligations.map((d) => ({ ...d, amount: minor(d.amount), settledAmount: minor(d.settledAmount) }));
  const totalDebit  = numericDebits.reduce((sum, d) => sum + d.amount, 0);

  // Allocate the whole credit pool across every debit oldest-first, treating
  // each as unsettled to begin with. Passing settledAmount: 0 is what makes
  // this a recompute rather than a top-up of whatever was there before.
  const { allocations } = allocatePayment(
    totalCredit,
    numericDebits.map((d) => ({ ...d, settledAmount: 0 })),
  );
  const settledById = new Map(allocations.map((a) => [a.chargeId, a.amount]));

  for (const debit of obligations) {
    const settled = settledById.get(debit.id) ?? 0;
    if (BigInt(settled) !== debit.settledAmount) {
      await db.companyLedgerEntry.update({
        where: { id: debit.id },
        data:  { settledAmount: BigInt(settled) },
      });
    }
  }

  const net = totalDebit - totalCredit;
  const position: CompanyPosition = {
    balance:         Math.max(0, net),
    unappliedCredit: Math.max(0, -net),
  };

  await db.company.update({ where: { id: companyId }, data: { balance: BigInt(position.balance) } });
  await syncCompanyInvoices(db, companyId);
  return position;
}

export const CompanyService = {
  async listCompanies(withTenant: WithTenantFn, query: ListCompaniesQuery) {
    const skip   = (query.page - 1) * query.limit;
    const search = query.search?.trim();
    const now    = new Date();

    const where: Prisma.CompanyWhereInput = {
      deletedAt: null,
      ...(query.type ? { type: query.type } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.withBalance ? { balance: { gt: 0n } } : {}),
      ...(query.overdue
        ? { ledgerEntries: { some: { type: { in: OBLIGATION_TYPES }, dueDate: { lt: now } } } }
        : {}),
      ...(search && {
        OR: [
          { name:         { contains: search, mode: "insensitive" as const } },
          { code:         { contains: search, mode: "insensitive" as const } },
          { contactName:  { contains: search, mode: "insensitive" as const } },
          { contactPhone: { contains: search, mode: "insensitive" as const } },
          { contactEmail: { contains: search, mode: "insensitive" as const } },
          { ntn:          { contains: search, mode: "insensitive" as const } },
        ],
      }),
    };

    const orderBy: Prisma.CompanyOrderByWithRelationInput =
      query.sort === "balance"   ? { balance: "desc" }
      : query.sort === "createdAt" ? { createdAt: "desc" }
      : { name: "asc" };

    return withTenant(async (db) => {
      const candidates = await db.company.findMany({ where, select: COMPANY_SELECT, orderBy });
      const overdueCandidates = query.overdue
        ? await db.companyLedgerEntry.findMany({
            where: {
              companyId: { in: candidates.map((company) => company.id) },
              type: { in: OBLIGATION_TYPES }, dueDate: { lt: now }, reversedAt: null,
            },
            select: { companyId: true, amount: true, settledAmount: true },
          })
        : [];
      const overdueIds = new Set(
        overdueCandidates
          .filter((row) => minor(row.amount) > minor(row.settledAmount))
          .map((row) => row.companyId),
      );
      const filtered = query.overdue ? candidates.filter((company) => overdueIds.has(company.id)) : candidates;
      const total = filtered.length;
      const items = filtered.slice(skip, skip + query.limit);

      // Overdue amount per company for the list badge. One grouped query rather
      // than N per-company aging calls.
      const overdueRows = items.length
        ? await db.companyLedgerEntry.findMany({
            where: {
              companyId: { in: items.map((c) => c.id) },
              type: { in: OBLIGATION_TYPES },
              dueDate: { lt: now },
              reversedAt: null,
            },
            select: { companyId: true, amount: true, settledAmount: true },
          })
        : [];

      const overdueByCompany = new Map<string, number>();
      for (const row of overdueRows) {
        const open = Math.max(0, minor(row.amount) - minor(row.settledAmount));
        if (open > 0) overdueByCompany.set(row.companyId, (overdueByCompany.get(row.companyId) ?? 0) + open);
      }

      return {
        data: items.map(companyJson).map((c) => ({
          ...c,
          overdueAmount:   overdueByCompany.get(c.id) ?? 0,
          availableCredit: Math.max(0, c.creditLimit - c.balance),
        })),
        meta: paginationMeta(total, query.page, query.limit),
      };
    });
  },

  /** Lightweight list for the booking-screen picker. */
  async searchForPicker(withTenant: WithTenantFn, search: string | undefined) {
    const term = search?.trim();
    return withTenant((db) =>
      db.company.findMany({
        where: {
          deletedAt: null,
          isActive: true,
          ...(term ? { name: { contains: term, mode: "insensitive" } } : {}),
        },
        select: {
          id: true, name: true, type: true, creditLimit: true, balance: true,
          paymentTerms: true, ratePlanId: true, discountPercent: true,
        },
        orderBy: { name: "asc" },
        take: 20,
      }).then((items) => items.map(companyJson))
    );
  },

  async getCompany(withTenant: WithTenantFn, id: string) {
    return withTenant(async (db) => {
      const company = await requireCompany(db, id);
      // Reconciling on read keeps the detail page honest even if an older
      // write left drift behind, and is cheap at one company at a time.
      const position = await reconcileCompany(db, id);
      const openCharges = await loadOpenCharges(db, id);
      const aging = summariseAging(openCharges, new Date());

      const [stayCount, lastEntry, ratePlan] = await Promise.all([
        db.reservation.count({ where: { companyId: id } }),
        db.companyLedgerEntry.findFirst({
          where: { companyId: id },
          orderBy: { entryDate: "desc" },
          select: { entryDate: true, type: true, amount: true },
        }),
        company.ratePlanId
          ? db.ratePlan.findUnique({ where: { id: company.ratePlanId }, select: { id: true, name: true } })
          : Promise.resolve(null),
      ]);

      return {
        ...companyJson(company),
        balance: position.balance,
        unappliedCredit: position.unappliedCredit,
        ratePlan,
        aging,
        availableCredit: Math.max(0, minor(company.creditLimit) - position.balance),
        stats: { totalReservations: stayCount, lastActivityAt: lastEntry?.entryDate ?? null },
      };
    });
  },

  async createCompany(withTenant: WithTenantFn, actor: JwtPayload, dto: CreateCompanyDto) {
    return withTenant(async (db) => {
      await assertNameAvailable(db, dto.name, null);
      if (dto.ratePlanId) await assertRatePlanBelongsToHotel(db, actor.hotelId, dto.ratePlanId);

      const company = await db.company.create({
        data: {
          hotelId: actor.hotelId,
          name: dto.name,
          type: dto.type,
          code: dto.code ?? null,
          contactName: dto.contactName ?? null,
          contactPhone: dto.contactPhone ?? null,
          contactEmail: dto.contactEmail ?? null,
          address: dto.address ?? null,
          city: dto.city ?? null,
          ntn: dto.ntn ?? null,
          strn: dto.strn ?? null,
          paymentTerms: dto.paymentTerms,
          ratePlanId: dto.ratePlanId ?? null,
          discountPercent: dto.discountPercent ?? null,
          notes: dto.notes ?? null,
          // creditLimit intentionally left at its 0 default — see the comment
          // on createCompanySchema.
        },
        select: COMPANY_SELECT,
      });

      notifyHotelDataChanged(actor.hotelId, "companies");
      await db.auditLog.create({
        data: { hotelId: actor.hotelId, userId: actor.userId, action: "COMPANY_CREATE", entity: "company", entityId: company.id, after: { name: company.name, type: company.type } },
      });
      return companyJson(company);
    });
  },

  async updateCompany(withTenant: WithTenantFn, actor: JwtPayload, id: string, dto: UpdateCompanyDto) {
    return withTenant(async (db) => {
      await requireCompany(db, id);
      if (dto.name) await assertNameAvailable(db, dto.name, id);
      if (dto.ratePlanId) await assertRatePlanBelongsToHotel(db, actor.hotelId, dto.ratePlanId);

      const company = await db.company.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.type !== undefined && { type: dto.type }),
          ...(dto.code !== undefined && { code: dto.code || null }),
          ...(dto.contactName !== undefined && { contactName: dto.contactName || null }),
          ...(dto.contactPhone !== undefined && { contactPhone: dto.contactPhone || null }),
          ...(dto.contactEmail !== undefined && { contactEmail: dto.contactEmail || null }),
          ...(dto.address !== undefined && { address: dto.address || null }),
          ...(dto.city !== undefined && { city: dto.city || null }),
          ...(dto.ntn !== undefined && { ntn: dto.ntn || null }),
          ...(dto.strn !== undefined && { strn: dto.strn || null }),
          ...(dto.paymentTerms !== undefined && { paymentTerms: dto.paymentTerms }),
          ...(dto.ratePlanId !== undefined && { ratePlanId: dto.ratePlanId || null }),
          ...(dto.discountPercent !== undefined && { discountPercent: dto.discountPercent ?? null }),
          ...(dto.notes !== undefined && { notes: dto.notes || null }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        },
        select: COMPANY_SELECT,
      });

      notifyHotelDataChanged(actor.hotelId, "companies");
      await db.auditLog.create({
        data: { hotelId: actor.hotelId, userId: actor.userId, action: "COMPANY_UPDATE", entity: "company", entityId: id, after: JSON.parse(JSON.stringify(dto)) },
      });
      return companyJson(company);
    });
  },

  /** Gated behind COMPANY_CREDIT_LIMIT, separately from ordinary edits. */
  async setCreditLimit(withTenant: WithTenantFn, actor: JwtPayload, id: string, dto: SetCreditLimitDto) {
    return withTenant(async (db) => {
      const existing = await requireCompany(db, id);

      const company = await db.company.update({
        where: { id },
        data: { creditLimit: BigInt(dto.creditLimit) },
        select: COMPANY_SELECT,
      });

      await db.auditLog.create({
        data: {
          hotelId: actor.hotelId,
          userId: actor.userId,
          action: "COMPANY_CREDIT_LIMIT_CHANGED",
          entity: "company",
          entityId: id,
          before: { creditLimit: minor(existing.creditLimit) },
          after:  { creditLimit: dto.creditLimit },
          notes:  dto.reason ?? null,
        },
      });

      notifyHotelDataChanged(actor.hotelId, "companies");
      const json = companyJson(company);
      return { ...json, availableCredit: Math.max(0, json.creditLimit - json.balance) };
    });
  },

  async deleteCompany(withTenant: WithTenantFn, actor: JwtPayload, id: string) {
    return withTenant(async (db) => {
      const company = await requireCompany(db, id);

      // Refusing rather than cascading: deleting a company that still owes
      // money would erase the receivable from every report at once. Reconcile
      // first so the check runs against the ledger rather than a possibly
      // stale denormalised balance, and check both directions — a company the
      // hotel owes money to must not vanish either.
      const position = await reconcileCompany(db, company.id);
      if (position.balance > 0) {
        throw new AppError(400, "This company has an outstanding balance. Settle or write off the balance before deleting it.");
      }
      if (position.unappliedCredit > 0) {
        throw new AppError(400, "This company has unused credit on their account. Refund or apply it before deleting them.");
      }

      await db.company.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
      await db.auditLog.create({
        data: { hotelId: actor.hotelId, userId: actor.userId, action: "COMPANY_DELETE", entity: "company", entityId: id, before: { name: company.name } },
      });
      notifyHotelDataChanged(actor.hotelId, "companies");
      return { id };
    });
  },

  // ── Ledger ────────────────────────────────────────────────────────────────

  async listLedger(withTenant: WithTenantFn, companyId: string, query: CompanyLedgerQuery) {
    const skip = (query.page - 1) * query.limit;

    return withTenant(async (db) => {
      await requireCompany(db, companyId);

      const where: Prisma.CompanyLedgerEntryWhereInput = {
        companyId,
        ...(query.from || query.to
          ? {
              entryDate: {
                ...(query.from ? { gte: new Date(`${query.from}T00:00:00.000Z`) } : {}),
                ...(query.to   ? { lte: new Date(`${query.to}T23:59:59.999Z`) } : {}),
              },
            }
          : {}),
      };

      const rows = await db.companyLedgerEntry.findMany({
          where, orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
          ...(query.status === "all" ? { skip, take: query.limit } : {}),
          select: {
            id: true, type: true, amount: true, description: true,
            entryDate: true, dueDate: true, settledAmount: true,
            folioId: true, reservationId: true, guestName: true, roomNumber: true,
            stayFrom: true, stayTo: true, paymentMethod: true, reference: true,
            invoiceId: true, createdAt: true, reversedAt: true, reversalReason: true,
          },
        });
      const totalAll = query.status === "all" ? await db.companyLedgerEntry.count({ where }) : rows.length;
      // "open"/"settled" filter applied here rather than in SQL because Prisma
      // cannot express `settled_amount < amount` in a where clause.
      //
      // Only debits can be open or settled. A payment is neither, so it is
      // excluded from both filtered views rather than being lumped in with
      // unpaid charges — otherwise the "Unpaid" tab lists money already
      // received and the count is meaningless.
      const statusRows = query.status === "all"
        ? rows
        : rows.filter((r) => {
            if (!OBLIGATION_TYPES.includes(r.type)) return false;
            const open = r.amount - r.settledAmount > 0n;
            return query.status === "open" ? open : !open;
          });
      const filtered = query.status === "all" ? statusRows : statusRows.slice(skip, skip + query.limit);
      const total = query.status === "all" ? totalAll : statusRows.length;

      return {
        data: filtered.map((r) => {
          const json = ledgerJson(r);
          return { ...json, outstanding: Math.max(0, json.amount - json.settledAmount) };
        }),
        meta: paginationMeta(total, query.page, query.limit),
      };
    });
  },

  async getStatement(withTenant: WithTenantFn, companyId: string) {
    return withTenant(async (db) => {
      const company = await requireCompany(db, companyId);
      const openCharges = await loadOpenCharges(db, companyId);
      const aging = summariseAging(openCharges, new Date());

      const entries = await db.companyLedgerEntry.findMany({
        where: { companyId },
        orderBy: { entryDate: "asc" },
        select: {
          id: true, type: true, amount: true, settledAmount: true, description: true,
          entryDate: true, dueDate: true, guestName: true, roomNumber: true,
          stayFrom: true, stayTo: true, folioId: true, invoiceId: true,
          paymentMethod: true, reference: true, createdAt: true, reversedAt: true,
        },
      });

      let runningBalance = 0;
      const lines = entries.map((row) => {
        const entry = ledgerJson(row);
        if (!entry.reversedAt) {
          runningBalance += DEBIT_TYPES.includes(entry.type) ? entry.amount : -entry.amount;
        }
        return { ...entry, outstanding: Math.max(0, entry.amount - entry.settledAmount), runningBalance };
      });

      return {
        company: companyJson(company),
        aging,
        lines,
        closingBalance: runningBalance,
      };
    });
  },

  /**
   * Move an unpaid folio balance onto the company's account.
   *
   * This is what makes credit actually work: the folio closes, the guest walks
   * out, and the money becomes the company's debt with a due date. Called both
   * from the folio screen directly and from checkout.
   */
  async transferFolio(
    db: TenantTx,
    actor: JwtPayload,
    folioId: string,
    companyId: string,
    opts: { amount?: number; note?: string; idempotencyKey: string },
  ) {
    const existingMovement = await db.companyLedgerEntry.findFirst({
      where: { hotelId: actor.hotelId, sourceKey: opts.idempotencyKey },
      select: { id: true, amount: true, dueDate: true, companyId: true },
    });
    if (existingMovement) {
      if (existingMovement.companyId !== companyId) throw new AppError(409, "This request key was already used for another company.");
      const position = await reconcileCompany(db, companyId);
      return { entry: { ...existingMovement, amount: minor(existingMovement.amount) }, companyBalance: position.balance, unappliedCredit: position.unappliedCredit };
    }

    // Serialize all credit decisions for this company. Without this lock, two
    // simultaneous checkouts can both observe the same available credit.
    await db.$queryRaw`SELECT id FROM companies WHERE id = ${companyId}::uuid AND hotel_id = ${actor.hotelId}::uuid FOR UPDATE`;
    const movementAfterLock = await db.companyLedgerEntry.findFirst({
      where: { hotelId: actor.hotelId, sourceKey: opts.idempotencyKey },
      select: { id: true, amount: true, dueDate: true, companyId: true },
    });
    if (movementAfterLock) {
      if (movementAfterLock.companyId !== companyId) throw new AppError(409, "This request key was already used for another company.");
      const position = await reconcileCompany(db, companyId);
      return { entry: { ...movementAfterLock, amount: minor(movementAfterLock.amount) }, companyBalance: position.balance, unappliedCredit: position.unappliedCredit };
    }
    const company = await db.company.findFirst({
      where: { id: companyId, deletedAt: null },
      select: { id: true, name: true, isActive: true, creditLimit: true, balance: true, paymentTerms: true },
    });
    if (!company) throw new AppError(404, "Company not found");
    if (!company.isActive) throw new AppError(400, `${company.name} is marked inactive and cannot take new charges.`);

    await db.$queryRaw`SELECT id FROM folios WHERE id = ${folioId}::uuid AND hotel_id = ${actor.hotelId}::uuid FOR UPDATE`;
    const folio = await db.folio.findUnique({
      where: { id: folioId },
      select: {
        id: true, folioNumber: true, balanceDue: true, isOpen: true,
        reservation: {
          select: {
            id: true, checkInDate: true, checkOutDate: true,
            guest: { select: { fullName: true } },
            rooms: { select: { room: { select: { number: true } } }, take: 1 },
          },
        },
      },
    });
    if (!folio) throw new AppError(404, "Folio not found");

    const amount = opts.amount ?? folio.balanceDue;
    if (amount <= 0) throw new AppError(400, "This folio has nothing left to transfer.");
    if (amount > folio.balanceDue) {
      throw new AppError(400, "Cannot transfer more than the folio's outstanding balance.");
    }

    const current = await reconcileCompany(db, companyId);
    const credit = checkCreditLimit(current.balance, minor(company.creditLimit), amount);
    if (!credit.allowed) throw new AppError(400, credit.reason ?? "Credit limit exceeded");

    const entryDate = new Date();
    const guestName = folio.reservation?.guest.fullName ?? null;
    const roomNumber = folio.reservation?.rooms[0]?.room.number ?? null;

    const entry = await db.companyLedgerEntry.create({
      data: {
        hotelId: actor.hotelId,
        companyId,
        type: CompanyLedgerEntryType.CHARGE,
        amount: BigInt(amount),
        description: opts.note?.trim()
          || `Folio ${folio.folioNumber}${guestName ? ` — ${guestName}` : ""}`,
        entryDate,
        dueDate: dueDateFor(entryDate, company.paymentTerms as CompanyPaymentTermsKey),
        folioId,
        reservationId: folio.reservation?.id ?? null,
        guestName,
        roomNumber,
        stayFrom: folio.reservation?.checkInDate ?? null,
        stayTo: folio.reservation?.checkOutDate ?? null,
        createdBy: actor.userId,
        sourceKey: opts.idempotencyKey,
      },
      select: { id: true, amount: true, dueDate: true },
    });

    // The folio is settled from the hotel's point of view — the debt now lives
    // on the company. Leaving balanceDue populated would double-count it in
    // every outstanding-balance report.
    await db.folio.update({
      where: { id: folioId },
      data: {
        balanceDue: folio.balanceDue - amount,
        ...(folio.balanceDue - amount === 0 ? { isOpen: false, closedAt: new Date(), closedBy: actor.userId } : {}),
      },
    });

    // Reconcile, not just recompute: if the company is sitting on unapplied
    // credit from an earlier overpayment, this new charge is settled from it
    // immediately rather than being chased on the aging report.
    const position = await reconcileCompany(db, companyId);

    await db.auditLog.create({
      data: {
        hotelId: actor.hotelId,
        userId: actor.userId,
        action: "COMPANY_FOLIO_TRANSFERRED",
        entity: "company_ledger_entry",
        entityId: entry.id,
        after: { companyId, folioId, amount, dueDate: entry.dueDate?.toISOString() ?? null },
      },
    });

    return {
      entry: { ...entry, amount: minor(entry.amount) },
      companyBalance: position.balance,
      unappliedCredit: position.unappliedCredit,
    };
  },

  async transferFolioStandalone(
    withTenant: WithTenantFn, actor: JwtPayload, folioId: string,
    dto: { companyId: string; amount?: number; note?: string; idempotencyKey: string },
  ) {
    const result = await withTenant((db) =>
      CompanyService.transferFolio(db, actor, folioId, dto.companyId, { amount: dto.amount, note: dto.note, idempotencyKey: dto.idempotencyKey })
    );
    notifyHotelDataChanged(actor.hotelId, "companies");
    return result;
  },

  /**
   * Record money received from a company and spread it across open charges.
   *
   * Agencies pay a lump sum against a statement, so the payment is one ledger
   * row and the allocation updates the charges it covers.
   */
  async recordPayment(withTenant: WithTenantFn, actor: JwtPayload, companyId: string, dto: RecordCompanyPaymentDto) {
    const result = await withTenant(async (db) => {
      await db.$queryRaw`SELECT id FROM companies WHERE id = ${companyId}::uuid AND hotel_id = ${actor.hotelId}::uuid FOR UPDATE`;
      const company = await requireCompany(db, companyId);
      const entryDate = parseDateOrToday(dto.paidAt);

      const existing = await db.companyLedgerEntry.findFirst({
        where: { hotelId: actor.hotelId, sourceKey: dto.idempotencyKey },
        select: { id: true, companyId: true, amount: true, entryDate: true, paymentMethod: true },
      });
      if (existing) {
        if (existing.companyId !== companyId) throw new AppError(409, "This payment request key was already used for another company.");
        const position = await reconcileCompany(db, companyId);
        return {
          payment: { ...existing, amount: minor(existing.amount) }, settledCharges: 0,
          unapplied: position.unappliedCredit, companyBalance: position.balance,
          unappliedCredit: position.unappliedCredit, companyName: company.name,
        };
      }

      // Previewed before the row is written so the response can report how
      // this specific payment lands; reconcileCompany below is what actually
      // sets the settled amounts.
      const openCharges = await loadOpenCharges(db, companyId);
      const { allocations, unapplied } = allocatePayment(dto.amount, openCharges);

      const payment = await db.companyLedgerEntry.create({
        data: {
          hotelId: actor.hotelId,
          companyId,
          type: CompanyLedgerEntryType.PAYMENT,
          amount: BigInt(dto.amount),
          description: dto.notes?.trim() || `Payment received from ${company.name}`,
          entryDate,
          paymentMethod: dto.method,
          reference: dto.reference ?? null,
          createdBy: actor.userId,
          sourceKey: dto.idempotencyKey,
        },
        select: { id: true, amount: true, entryDate: true, paymentMethod: true },
      });

      const position = await reconcileCompany(db, companyId);

      await db.auditLog.create({
        data: {
          hotelId: actor.hotelId,
          userId: actor.userId,
          action: "COMPANY_PAYMENT_RECORDED",
          entity: "company_ledger_entry",
          entityId: payment.id,
          after: {
            companyId, amount: dto.amount, method: dto.method, unapplied,
            allocations: allocations.map((a) => ({ chargeId: a.chargeId, amount: a.amount })),
          },
        },
      });

      notifyHotelDataChanged(actor.hotelId, "companies");

      return {
        payment: { ...payment, amount: minor(payment.amount) },
        settledCharges: allocations.length,
        // Surfaced rather than hidden: an agency that overpays has a credit
        // sitting with the hotel and the front desk needs to know.
        unapplied,
        companyBalance: position.balance,
        unappliedCredit: position.unappliedCredit,
        companyName: company.name,
      };
    });
    createLedgerEntryFromCompanyMovement(actor.hotelId, {
      id: result.payment.id, companyName: result.companyName,
      amount: result.payment.amount, method: result.payment.paymentMethod ?? dto.method,
      direction: "INCOMING", entryDate: dto.paidAt,
    }, actor.userId).catch(() => { /* reconciliation repairs a missed secondary movement */ });
    return result;
  },

  async reversePayment(
    withTenant: WithTenantFn, actor: JwtPayload, companyId: string,
    paymentId: string, dto: ReverseCompanyPaymentDto,
  ) {
    const result = await withTenant(async (db) => {
      await db.$queryRaw`SELECT id FROM companies WHERE id = ${companyId}::uuid AND hotel_id = ${actor.hotelId}::uuid FOR UPDATE`;
      const company = await requireCompany(db, companyId);
      const payment = await db.companyLedgerEntry.findFirst({
        where: { id: paymentId, companyId, type: CompanyLedgerEntryType.PAYMENT },
        select: { id: true, amount: true, paymentMethod: true, entryDate: true, reversedAt: true },
      });
      if (!payment) throw new AppError(404, "Company payment not found");
      if (payment.reversedAt) throw new AppError(409, "This company payment is already reversed");
      await db.companyLedgerEntry.update({
        where: { id: payment.id },
        data: { reversedAt: new Date(), reversedBy: actor.userId, reversalReason: dto.reason },
      });
      const position = await reconcileCompany(db, companyId);
      await db.auditLog.create({
        data: { hotelId: actor.hotelId, userId: actor.userId, action: "COMPANY_PAYMENT_REVERSED", entity: "company_ledger_entry", entityId: payment.id, notes: dto.reason, after: { companyId, amount: minor(payment.amount) } },
      });
      return { payment: { ...payment, amount: minor(payment.amount) }, companyName: company.name, ...position };
    });
    createLedgerEntryFromCompanyMovement(actor.hotelId, {
      id: result.payment.id, companyName: result.companyName, amount: result.payment.amount,
      method: result.payment.paymentMethod ?? "BANK_TRANSFER", direction: "OUTGOING",
      entryDate: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(new Date()),
    }, actor.userId).catch(() => { /* Balance Book reconciliation repairs this */ });
    notifyHotelDataChanged(actor.hotelId, "companies");
    return result;
  },

  async refundCredit(withTenant: WithTenantFn, actor: JwtPayload, companyId: string, dto: RefundCompanyCreditDto) {
    const result = await withTenant(async (db) => {
      await db.$queryRaw`SELECT id FROM companies WHERE id = ${companyId}::uuid AND hotel_id = ${actor.hotelId}::uuid FOR UPDATE`;
      const company = await requireCompany(db, companyId);
      const existing = await db.companyLedgerEntry.findFirst({
        where: { hotelId: actor.hotelId, sourceKey: dto.idempotencyKey },
        select: { id: true, companyId: true, amount: true, entryDate: true, paymentMethod: true },
      });
      if (existing) {
        if (existing.companyId !== companyId) throw new AppError(409, "This refund request key was already used for another company.");
        return { entry: { ...existing, amount: minor(existing.amount) }, companyName: company.name, ...(await reconcileCompany(db, companyId)) };
      }
      const position = await reconcileCompany(db, companyId);
      if (dto.amount > position.unappliedCredit) {
        throw new AppError(400, `Only PKR ${(position.unappliedCredit / 100).toLocaleString("en-PK")} is available to refund.`);
      }
      const entry = await db.companyLedgerEntry.create({
        data: {
          hotelId: actor.hotelId, companyId, type: CompanyLedgerEntryType.CREDIT_REFUND,
          amount: BigInt(dto.amount), description: `Credit refunded — ${dto.reason}`,
          entryDate: parseDateOrToday(dto.paidAt), paymentMethod: dto.method,
          reference: dto.reference ?? null, createdBy: actor.userId, sourceKey: dto.idempotencyKey,
        },
        select: { id: true, amount: true, entryDate: true, paymentMethod: true },
      });
      const next = await reconcileCompany(db, companyId);
      await db.auditLog.create({
        data: { hotelId: actor.hotelId, userId: actor.userId, action: "COMPANY_CREDIT_REFUNDED", entity: "company_ledger_entry", entityId: entry.id, notes: dto.reason, after: { companyId, amount: dto.amount, method: dto.method } },
      });
      return { entry: { ...entry, amount: minor(entry.amount) }, companyName: company.name, ...next };
    });
    createLedgerEntryFromCompanyMovement(actor.hotelId, {
      id: result.entry.id, companyName: result.companyName, amount: result.entry.amount,
      method: result.entry.paymentMethod ?? dto.method, direction: "OUTGOING", entryDate: dto.paidAt,
    }, actor.userId).catch(() => { /* Balance Book reconciliation repairs this */ });
    notifyHotelDataChanged(actor.hotelId, "companies");
    return result;
  },

  async adjustLedger(withTenant: WithTenantFn, actor: JwtPayload, companyId: string, dto: AdjustCompanyLedgerDto) {
    return withTenant(async (db) => {
      const company = await requireCompany(db, companyId);
      const entryDate = parseDateOrToday(dto.entryDate);

      if (dto.type === "WRITE_OFF" && dto.amount > minor(company.balance)) {
        throw new AppError(400, "Cannot write off more than the company currently owes.");
      }

      const entry = await db.companyLedgerEntry.create({
        data: {
          hotelId: actor.hotelId,
          companyId,
          type: dto.type === "WRITE_OFF" ? CompanyLedgerEntryType.WRITE_OFF : CompanyLedgerEntryType.ADJUSTMENT,
          amount: BigInt(dto.amount),
          description: dto.description,
          entryDate,
          ...(dto.type === "ADJUSTMENT"
            ? { dueDate: dueDateFor(entryDate, company.paymentTerms as CompanyPaymentTermsKey) }
            : {}),
          createdBy: actor.userId,
        },
        select: { id: true, type: true, amount: true, description: true, entryDate: true },
      });

      // Reconcile handles both directions: a WRITE_OFF closes out the charges
      // it forgives (otherwise the aging report keeps chasing abandoned debt),
      // and an ADJUSTMENT is itself settled from any credit on the account.
      const position = await reconcileCompany(db, companyId);

      await db.auditLog.create({
        data: {
          hotelId: actor.hotelId,
          userId: actor.userId,
          action: dto.type === "WRITE_OFF" ? "COMPANY_DEBT_WRITTEN_OFF" : "COMPANY_LEDGER_ADJUSTED",
          entity: "company_ledger_entry",
          entityId: entry.id,
          after: { companyId, amount: dto.amount },
          notes: dto.description,
        },
      });

      notifyHotelDataChanged(actor.hotelId, "companies");
      return { entry: { ...entry, amount: minor(entry.amount) }, companyBalance: position.balance, unappliedCredit: position.unappliedCredit };
    });
  },

  // ── Invoices ──────────────────────────────────────────────────────────────

  async createInvoice(withTenant: WithTenantFn, actor: JwtPayload, companyId: string, dto: CreateCompanyInvoiceDto) {
    return withTenant(async (db) => {
      const company = await requireCompany(db, companyId);
      const periodStart = new Date(`${dto.periodStart}T00:00:00.000Z`);
      const periodEnd   = new Date(`${dto.periodEnd}T23:59:59.999Z`);

      // Only charges not already on an invoice — re-running a month must not
      // bill the same stays twice. Adjustments (a late fee, a correction) are
      // billable too, so they belong on the invoice alongside the stays.
      const lines = await db.companyLedgerEntry.findMany({
        where: {
          companyId,
          type: { in: OBLIGATION_TYPES },
          reversedAt: null,
          invoiceId: null,
          entryDate: { gte: periodStart, lte: periodEnd },
        },
        orderBy: { entryDate: "asc" },
        select: { id: true, amount: true },
      });

      if (lines.length === 0) {
        throw new AppError(400, "There are no un-invoiced charges for this company in that period.");
      }

      const subtotal = lines.reduce((sum, line) => sum + line.amount, 0n);
      await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${actor.hotelId}), hashtext('company_invoice_number'))`;
      const invoiceNumber = await generateInvoiceNumber(db, actor.hotelId);
      const issuedAt = dto.issue ? new Date() : null;

      const invoice = await db.companyInvoice.create({
        data: {
          hotelId: actor.hotelId,
          companyId,
          invoiceNumber,
          status: dto.issue ? CompanyInvoiceStatus.ISSUED : CompanyInvoiceStatus.DRAFT,
          periodStart,
          periodEnd: new Date(`${dto.periodEnd}T00:00:00.000Z`),
          subtotal,
          // Folio charges are already tax-inclusive — the tax was calculated and
          // posted per folio item. Re-taxing the consolidated total would
          // double-charge GST.
          taxAmount: 0,
          totalAmount: subtotal,
          issuedAt,
          dueDate: issuedAt
            ? dueDateFor(issuedAt, company.paymentTerms as CompanyPaymentTermsKey)
            : null,
          notes: dto.notes ?? null,
          createdBy: actor.userId,
        },
        select: {
          id: true, invoiceNumber: true, status: true, periodStart: true, periodEnd: true,
          subtotal: true, taxAmount: true, totalAmount: true, paidAmount: true,
          issuedAt: true, dueDate: true, notes: true, createdAt: true,
        },
      });

      await db.companyLedgerEntry.updateMany({
        where: { id: { in: lines.map((l) => l.id) } },
        data: { invoiceId: invoice.id },
      });

      await db.auditLog.create({
        data: { hotelId: actor.hotelId, userId: actor.userId, action: dto.issue ? "COMPANY_INVOICE_ISSUED" : "COMPANY_INVOICE_CREATED", entity: "company_invoice", entityId: invoice.id, after: { companyId, invoiceNumber, lineCount: lines.length } },
      });

      notifyHotelDataChanged(actor.hotelId, "companies");
      return { ...invoiceJson(invoice), lineCount: lines.length };
    });
  },

  async listInvoices(withTenant: WithTenantFn, companyId: string) {
    return withTenant(async (db) => {
      await requireCompany(db, companyId);
      const invoices = await db.companyInvoice.findMany({
        where: { companyId },
        orderBy: { periodEnd: "desc" },
        select: {
          id: true, invoiceNumber: true, status: true, periodStart: true, periodEnd: true,
          subtotal: true, taxAmount: true, totalAmount: true, paidAmount: true,
          issuedAt: true, dueDate: true, createdAt: true,
          _count: { select: { lines: true } },
        },
      });
      return invoices.map(invoiceJson);
    });
  },

  async getInvoice(withTenant: WithTenantFn, companyId: string, invoiceId: string) {
    return withTenant(async (db) => {
      const company = await requireCompany(db, companyId);
      const invoice = await db.companyInvoice.findFirst({
        where: { id: invoiceId, companyId },
        include: {
          lines: {
            orderBy: { entryDate: "asc" },
            select: {
              id: true, amount: true, settledAmount: true, description: true,
              entryDate: true, guestName: true, roomNumber: true,
              stayFrom: true, stayTo: true,
            },
          },
        },
      });
      if (!invoice) throw new AppError(404, "Invoice not found");
      return {
        ...invoiceJson(invoice), company: companyJson(company),
        lines: invoice.lines.map(ledgerJson),
      };
    });
  },

  async issueInvoice(withTenant: WithTenantFn, actor: JwtPayload, companyId: string, invoiceId: string) {
    return withTenant(async (db) => {
      const company = await requireCompany(db, companyId);
      const invoice = await db.companyInvoice.findFirst({ where: { id: invoiceId, companyId } });
      if (!invoice) throw new AppError(404, "Invoice not found");
      if (invoice.status !== CompanyInvoiceStatus.DRAFT) throw new AppError(400, "Only draft invoices can be issued");
      const issuedAt = new Date();
      const updated = await db.companyInvoice.update({
        where: { id: invoiceId },
        data: { status: CompanyInvoiceStatus.ISSUED, issuedAt, dueDate: dueDateFor(issuedAt, company.paymentTerms as CompanyPaymentTermsKey) },
      });
      await db.auditLog.create({ data: { hotelId: actor.hotelId, userId: actor.userId, action: "COMPANY_INVOICE_ISSUED", entity: "company_invoice", entityId: invoiceId, after: { companyId, invoiceNumber: invoice.invoiceNumber } } });
      notifyHotelDataChanged(actor.hotelId, "companies");
      return invoiceJson(updated);
    });
  },

  async voidInvoice(withTenant: WithTenantFn, actor: JwtPayload, companyId: string, invoiceId: string, reason: string) {
    return withTenant(async (db) => {
      await requireCompany(db, companyId);
      const invoice = await db.companyInvoice.findFirst({ where: { id: invoiceId, companyId } });
      if (!invoice) throw new AppError(404, "Invoice not found");
      if (invoice.status === CompanyInvoiceStatus.VOID) throw new AppError(409, "Invoice is already void");
      if (invoice.paidAmount > 0n) throw new AppError(400, "A paid or partially paid invoice cannot be voided. Reverse its payments first.");
      await db.companyLedgerEntry.updateMany({ where: { invoiceId }, data: { invoiceId: null } });
      const updated = await db.companyInvoice.update({ where: { id: invoiceId }, data: { status: CompanyInvoiceStatus.VOID, notes: [invoice.notes, `Void: ${reason}`].filter(Boolean).join("\n") } });
      await db.auditLog.create({ data: { hotelId: actor.hotelId, userId: actor.userId, action: "COMPANY_INVOICE_VOID", entity: "company_invoice", entityId: invoiceId, notes: reason, before: { status: invoice.status }, after: { status: "VOID" } } });
      notifyHotelDataChanged(actor.hotelId, "companies");
      return invoiceJson(updated);
    });
  },

  async emailInvoice(withTenant: WithTenantFn, actor: JwtPayload, companyId: string, invoiceId: string) {
    const payload = await withTenant(async (db) => {
      const company = await requireCompany(db, companyId);
      if (!company.contactEmail) throw new AppError(400, "Add a billing email to this company before sending an invoice.");
      const invoice = await db.companyInvoice.findFirst({
        where: { id: invoiceId, companyId },
        include: { lines: { orderBy: { entryDate: "asc" } } },
      });
      if (!invoice) throw new AppError(404, "Invoice not found");
      if (invoice.status === CompanyInvoiceStatus.DRAFT) throw new AppError(400, "Issue this draft before emailing it.");
      if (invoice.status === CompanyInvoiceStatus.VOID) throw new AppError(400, "A void invoice cannot be emailed.");
      const hotel = await db.hotel.findUnique({
        where: { id: actor.hotelId },
        select: { name: true, phone: true, email: true, address: true, city: true },
      });
      if (!hotel) throw new AppError(404, "Hotel not found");
      return { company, invoice, hotel };
    });
    const rows = payload.invoice.lines.map((line) => `
      <tr><td style="padding:12px;border-bottom:1px solid #e9e2db;color:#292622">${escapeHtml(line.description)}</td>
      <td style="padding:12px;border-bottom:1px solid #e9e2db;text-align:right;color:#292622">${escapeHtml(formatPkr(line.amount))}</td></tr>`).join("");
    const result = await sendEmail({
      to: payload.company.contactEmail!, toName: payload.company.contactName ?? payload.company.name,
      subject: `${payload.invoice.invoiceNumber} from ${payload.hotel.name}`,
      htmlBody: `<!doctype html><html><body style="margin:0;background:#f5efe9;font-family:Arial,sans-serif;color:#292622"><div style="max-width:680px;margin:0 auto;padding:32px 18px"><div style="background:#241f1b;border-radius:20px 20px 0 0;padding:28px;color:#fff"><div style="font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#e9542b">Company invoice</div><h1 style="margin:9px 0 0;font-size:30px">${escapeHtml(payload.invoice.invoiceNumber)}</h1><p style="margin:8px 0 0;color:#cfc7bf">From ${escapeHtml(payload.hotel.name)}</p></div><div style="background:#fff;padding:28px;border-radius:0 0 20px 20px"><p style="font-size:16px">Hello ${escapeHtml(payload.company.contactName ?? payload.company.name)},</p><p style="color:#645e58;line-height:1.6">Here is your consolidated stay invoice. It is due ${payload.invoice.dueDate ? escapeHtml(payload.invoice.dueDate.toLocaleDateString("en-PK")) : "on receipt"}.</p><table style="width:100%;border-collapse:collapse;margin:22px 0">${rows}<tr><td style="padding:16px 12px;font-weight:bold">Balance due</td><td style="padding:16px 12px;text-align:right;font-size:20px;font-weight:bold;color:#e9542b">${escapeHtml(formatPkr(payload.invoice.totalAmount - payload.invoice.paidAmount))}</td></tr></table><div style="border-top:1px solid #e9e2db;padding-top:18px;color:#716a63;font-size:13px;line-height:1.6">${escapeHtml(payload.hotel.name)}${payload.hotel.address ? `<br>${escapeHtml(payload.hotel.address)}` : ""}${payload.hotel.city ? `, ${escapeHtml(payload.hotel.city)}` : ""}${payload.hotel.phone ? `<br>${escapeHtml(payload.hotel.phone)}` : ""}${payload.hotel.email ? `<br>${escapeHtml(payload.hotel.email)}` : ""}</div></div></div></body></html>`,
    });
    if (!result.success) throw new AppError(502, result.error ?? "The invoice email could not be sent.");
    await withTenant((db) => db.auditLog.create({ data: {
      hotelId: actor.hotelId, userId: actor.userId, action: "COMPANY_INVOICE_EMAILED",
      entity: "company_invoice", entityId: invoiceId,
      after: { companyId, recipient: payload.company.contactEmail, messageId: result.messageId ?? null },
    } }));
    return { sent: true, recipient: payload.company.contactEmail };
  },

  // ── Reporting ─────────────────────────────────────────────────────────────

  /** Aging across every company — the "who owes us what" screen. */
  async agingReport(withTenant: WithTenantFn, query: AgingReportQuery) {
    const asOf = parseDateOrToday(query.asOf);
    const asOfEnd = new Date(asOf);
    asOfEnd.setUTCHours(23, 59, 59, 999);

    return withTenant(async (db) => {
      const companies = await db.company.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true, type: true, balance: true, creditLimit: true, paymentTerms: true, contactPhone: true },
        orderBy: { balance: "desc" },
      });

      if (companies.length === 0) {
        return { data: [], totals: emptyAging() };
      }

      const rows = await db.companyLedgerEntry.findMany({
        where: {
          companyId: { in: companies.map((c) => c.id) }, entryDate: { lte: asOfEnd },
          OR: [{ reversedAt: null }, { reversedAt: { gt: asOfEnd } }],
        },
        select: { id: true, companyId: true, type: true, amount: true, dueDate: true, entryDate: true },
      });

      const byCompany = new Map<string, typeof rows>();
      for (const row of rows) byCompany.set(row.companyId, [...(byCompany.get(row.companyId) ?? []), row]);

      const data = companies.map((company) => {
        const entries = byCompany.get(company.id) ?? [];
        const obligations: OpenCharge[] = entries
          .filter((row) => OBLIGATION_TYPES.includes(row.type))
          .map((row) => ({ id: row.id, amount: minor(row.amount), settledAmount: 0, dueDate: row.dueDate, entryDate: row.entryDate }));
        const credits = entries.filter((row) => CREDIT_TYPES.includes(row.type)).reduce((sum, row) => sum + minor(row.amount), 0);
        const refunds = entries.filter((row) => row.type === CompanyLedgerEntryType.CREDIT_REFUND).reduce((sum, row) => sum + minor(row.amount), 0);
        const { allocations } = allocatePayment(Math.max(0, credits - refunds), obligations);
        const settled = new Map(allocations.map((allocation) => [allocation.chargeId, allocation.amount]));
        const historicalOpen = obligations.map((row) => ({ ...row, settledAmount: settled.get(row.id) ?? 0 }));
        const aging = summariseAging(historicalOpen, asOf);
        const json = companyJson(company);
        return { company: { ...json, balance: aging.total }, availableCredit: Math.max(0, json.creditLimit - aging.total), aging };
      }).filter((row) => !query.onlyOutstanding || row.aging.total > 0);

      const totals = data.reduce<AgingSummary>((acc, row) => ({
        current:  acc.current  + row.aging.current,
        d1_30:    acc.d1_30    + row.aging.d1_30,
        d31_60:   acc.d31_60   + row.aging.d31_60,
        d61_90:   acc.d61_90   + row.aging.d61_90,
        d90_plus: acc.d90_plus + row.aging.d90_plus,
        total:    acc.total    + row.aging.total,
        overdue:  acc.overdue  + row.aging.overdue,
        oldestOverdueDays: Math.max(acc.oldestOverdueDays ?? 0, row.aging.oldestOverdueDays ?? 0) || null,
      }), emptyAging());

      return { data, totals, asOf };
    });
  },

  /** Every reservation booked under a company, for its detail page. */
  async listCompanyReservations(withTenant: WithTenantFn, companyId: string, limit = 50) {
    return withTenant(async (db) => {
      await requireCompany(db, companyId);
      return db.reservation.findMany({
        where: { companyId },
        orderBy: { checkInDate: "desc" },
        take: limit,
        select: {
          id: true, confirmationNumber: true, status: true,
          checkInDate: true, checkOutDate: true, totalAmount: true, balanceDue: true,
          billToCompany: true,
          guest: { select: { id: true, fullName: true } },
          rooms: { select: { room: { select: { number: true } } }, take: 1 },
        },
      });
    });
  },
};

async function syncCompanyInvoices(db: TenantTx, companyId: string): Promise<void> {
  const invoices = await db.companyInvoice.findMany({
    where: { companyId, status: { notIn: [CompanyInvoiceStatus.DRAFT, CompanyInvoiceStatus.VOID] } },
    select: {
      id: true, totalAmount: true, paidAmount: true, status: true,
      lines: { select: { amount: true, settledAmount: true } },
    },
  });
  for (const invoice of invoices) {
    const paid = invoice.lines.reduce(
      (sum, line) => sum + (line.settledAmount < line.amount ? line.settledAmount : line.amount),
      0n,
    );
    const status = paid <= 0n
      ? CompanyInvoiceStatus.ISSUED
      : paid >= invoice.totalAmount
        ? CompanyInvoiceStatus.PAID
        : CompanyInvoiceStatus.PARTIALLY_PAID;
    if (paid !== invoice.paidAmount || status !== invoice.status) {
      await db.companyInvoice.update({ where: { id: invoice.id }, data: { paidAmount: paid, status } });
    }
  }
}

function emptyAging(): AgingSummary {
  return { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0, total: 0, overdue: 0, oldestOverdueDays: null };
}

async function assertNameAvailable(db: TenantTx, name: string, excludeId: string | null) {
  const clash = await db.company.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      deletedAt: null,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });
  if (clash) throw new AppError(409, `A company named "${name}" already exists.`);
}

export async function assertCompanyBelongsToHotel(
  db: TenantTx, hotelId: string, companyId: string,
): Promise<void> {
  const company = await db.company.findFirst({
    where: { id: companyId, hotelId, deletedAt: null, isActive: true }, select: { id: true },
  });
  if (!company) throw new AppError(400, "The selected company is unavailable for this hotel.");
}

async function assertRatePlanBelongsToHotel(db: TenantTx, hotelId: string, ratePlanId: string): Promise<void> {
  // The legacy default-plan field may only point at a hotel-wide plan. A plan
  // owned by another company must never become this company's fallback.
  const ratePlan = await db.ratePlan.findFirst({
    where: { id: ratePlanId, hotelId, companyId: null },
    select: { id: true },
  });
  if (!ratePlan) throw new AppError(400, "The selected rate plan is unavailable for this hotel.");
}

/** INV-CO-YYYYMM-#### scoped per hotel, so numbers read sensibly on a statement. */
async function generateInvoiceNumber(db: TenantTx, hotelId: string): Promise<string> {
  const now = new Date();
  const prefix = `INV-CO-${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const last = await db.companyInvoice.findFirst({
    where: { hotelId, invoiceNumber: { startsWith: prefix } },
    orderBy: { invoiceNumber: "desc" },
    select: { invoiceNumber: true },
  });
  const seq = last ? Number(last.invoiceNumber.split("-").pop()) + 1 : 1;
  return `${prefix}-${String(seq).padStart(4, "0")}`;
}
