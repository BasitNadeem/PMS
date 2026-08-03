/**
 * Pure credit-account arithmetic: due dates, aging buckets, payment allocation
 * and limit checks.
 *
 * Deliberately imports nothing from `@pms/db` — that package opens a database
 * connection at module load, which would make these unit tests need a live
 * Postgres. The enum values are mirrored as string unions instead; the
 * `satisfies` check in the service keeps them from drifting apart.
 */

export type CompanyPaymentTermsKey =
  | "IMMEDIATE"
  | "NET_7"
  | "NET_15"
  | "NET_30"
  | "NET_45"
  | "NET_60"
  | "NET_90";

/** Days of credit each term grants, counted from the charge date. */
export const NET_DAYS: Record<CompanyPaymentTermsKey, number> = {
  IMMEDIATE: 0,
  NET_7:  7,
  NET_15: 15,
  NET_30: 30,
  NET_45: 45,
  NET_60: 60,
  NET_90: 90,
};

export const AGING_BUCKETS = ["current", "d1_30", "d31_60", "d61_90", "d90_plus"] as const;
export type AgingBucket = typeof AGING_BUCKETS[number];

export interface OpenCharge {
  id: string;
  /** Minor units (paisa). */
  amount: number;
  /** Minor units already covered by payments. */
  settledAmount: number;
  dueDate: Date | null;
  entryDate: Date;
}

export interface AgingSummary {
  current:  number;
  d1_30:    number;
  d31_60:   number;
  d61_90:   number;
  d90_plus: number;
  total:    number;
  /** Everything past its due date, i.e. total minus `current`. */
  overdue:  number;
  /** Age in days of the oldest unsettled charge, or null when nothing is due. */
  oldestOverdueDays: number | null;
}

const MS_PER_DAY = 86_400_000;

/** Whole days between two instants, ignoring time of day. */
export function daysBetween(from: Date, to: Date): number {
  const a = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const b = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.round((b - a) / MS_PER_DAY);
}

/**
 * When a charge raised on `entryDate` falls due under `terms`.
 * IMMEDIATE returns the entry date itself — the charge is overdue tomorrow.
 */
export function dueDateFor(entryDate: Date, terms: CompanyPaymentTermsKey): Date {
  const due = new Date(entryDate.getTime());
  due.setUTCDate(due.getUTCDate() + NET_DAYS[terms]);
  return due;
}

/**
 * Which aging bucket a charge sits in as of `asOf`.
 *
 * Buckets count days *past due*, not days since the charge was raised — a
 * 60-day-old charge on NET_90 terms is still current, and reporting it as
 * overdue would have the front desk chasing an agency that owes nothing yet.
 * A charge with no due date is treated as due on its entry date.
 */
export function agingBucketOf(charge: OpenCharge, asOf: Date): AgingBucket {
  const due = charge.dueDate ?? charge.entryDate;
  const overdueDays = daysBetween(due, asOf);
  if (overdueDays <= 0) return "current";
  if (overdueDays <= 30) return "d1_30";
  if (overdueDays <= 60) return "d31_60";
  if (overdueDays <= 90) return "d61_90";
  return "d90_plus";
}

/** Unpaid remainder of a charge. */
export function outstandingOf(charge: OpenCharge): number {
  return Math.max(0, charge.amount - charge.settledAmount);
}

export function summariseAging(charges: readonly OpenCharge[], asOf: Date): AgingSummary {
  const summary: AgingSummary = {
    current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0,
    total: 0, overdue: 0, oldestOverdueDays: null,
  };

  for (const charge of charges) {
    const outstanding = outstandingOf(charge);
    if (outstanding === 0) continue;

    const bucket = agingBucketOf(charge, asOf);
    summary[bucket] += outstanding;
    summary.total   += outstanding;

    if (bucket !== "current") {
      summary.overdue += outstanding;
      const days = daysBetween(charge.dueDate ?? charge.entryDate, asOf);
      if (summary.oldestOverdueDays === null || days > summary.oldestOverdueDays) {
        summary.oldestOverdueDays = days;
      }
    }
  }

  return summary;
}

export interface Allocation {
  chargeId: string;
  amount:   number;
}

export interface AllocationResult {
  allocations: Allocation[];
  /** Payment left over after every open charge is settled — sits as a credit. */
  unapplied:   number;
}

/**
 * Spread a payment across open charges oldest-first.
 *
 * FIFO rather than letting the user pick: agencies pay a lump sum against a
 * statement, not against specific folios, and oldest-first is what every
 * accountant expects. Leftover money is reported as `unapplied` instead of
 * being silently dropped or forced onto the newest charge.
 */
export function allocatePayment(
  amount: number,
  charges: readonly OpenCharge[],
): AllocationResult {
  if (amount <= 0) return { allocations: [], unapplied: 0 };

  const open = charges
    .filter((c) => outstandingOf(c) > 0)
    .sort((a, b) => {
      const aDue = (a.dueDate ?? a.entryDate).getTime();
      const bDue = (b.dueDate ?? b.entryDate).getTime();
      if (aDue !== bDue) return aDue - bDue;
      // Stable tiebreak so two charges due the same day allocate deterministically.
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });

  const allocations: Allocation[] = [];
  let remaining = amount;

  for (const charge of open) {
    if (remaining <= 0) break;
    const applied = Math.min(remaining, outstandingOf(charge));
    allocations.push({ chargeId: charge.id, amount: applied });
    remaining -= applied;
  }

  return { allocations, unapplied: remaining };
}

export interface CreditCheck {
  allowed:   boolean;
  /** Credit still available before this charge. Never negative. */
  available: number;
  /** How much this charge would exceed the limit by. 0 when it fits. */
  shortfall: number;
  reason:    string | null;
}

/**
 * Whether a company can absorb another `amount` of charge.
 *
 * A limit of 0 means "no credit extended" — the company exists for reporting
 * and negotiated rates but its guests must settle at checkout. That is the
 * safe default for a newly created company: staff must make a deliberate
 * decision to lend money.
 */
export function checkCreditLimit(
  balance: number,
  creditLimit: number,
  amount: number,
): CreditCheck {
  const available = Math.max(0, creditLimit - balance);

  if (creditLimit <= 0) {
    return {
      allowed: false, available: 0, shortfall: amount,
      reason: "This company has no credit limit set. Set a limit before billing charges to its account.",
    };
  }
  if (amount > available) {
    return {
      allowed: false, available, shortfall: amount - available,
      reason: `Charge exceeds the remaining credit limit. Available: ${available}, required: ${amount}.`,
    };
  }
  return { allowed: true, available, shortfall: 0, reason: null };
}
