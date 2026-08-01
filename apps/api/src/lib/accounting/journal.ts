/**
 * The canonical journal every export format is serialised from.
 *
 * Deliberately free of `@pms/db` imports so the arithmetic — which is the part
 * that must not be wrong — can be unit-tested without a database.
 *
 * All amounts are minor units (paisa), matching the rest of the codebase.
 * Conversion to PKR happens once, in the serialisers.
 */

export interface JournalLine {
  /** ISO date (YYYY-MM-DD) the entry is posted on. */
  date: string;
  accountCode: string;
  accountName: string;
  /** Exactly one of debit/credit is non-zero. */
  debit: number;
  credit: number;
  narration: string;
  /**
   * Stable origin reference, `sourceType:sourceId`. Carried into every format
   * so the receiving system can dedupe a re-import rather than trusting the
   * operator to only import once.
   */
  reference: string;
}

export interface JournalBatch {
  periodStart: string;
  periodEnd: string;
  lines: JournalLine[];
  totalDebit: number;
  totalCredit: number;
  /** False when debits and credits disagree — never export a false batch. */
  balanced: boolean;
}

export function debit(
  date: string, account: { accountCode: string; accountName: string },
  amount: number, narration: string, reference: string,
): JournalLine {
  return { date, accountCode: account.accountCode, accountName: account.accountName, debit: amount, credit: 0, narration, reference };
}

export function credit(
  date: string, account: { accountCode: string; accountName: string },
  amount: number, narration: string, reference: string,
): JournalLine {
  return { date, accountCode: account.accountCode, accountName: account.accountName, debit: 0, credit: amount, narration, reference };
}

/**
 * Collapses lines to one per (date, account, sign).
 *
 * Accountants overwhelmingly prefer a daily summary journal to hundreds of
 * individual postings — a month of POS sales as 400 lines is unreadable and
 * slow to import. Per-transaction detail stays available as an option.
 *
 * Debits and credits on the same account are kept apart rather than netted, so
 * a day with both a charge and a refund still shows the gross movement.
 */
export function summariseByDay(lines: JournalLine[]): JournalLine[] {
  const buckets = new Map<string, JournalLine>();

  for (const line of lines) {
    const side = line.debit > 0 ? "D" : "C";
    const key  = `${line.date}|${line.accountCode}|${side}`;
    const existing = buckets.get(key);

    if (existing) {
      existing.debit  += line.debit;
      existing.credit += line.credit;
    } else {
      buckets.set(key, {
        ...line,
        // The per-transaction narration and reference no longer describe a
        // single event once merged, so both are generalised.
        narration: `${line.accountName} — daily total`,
        reference: `SUMMARY:${line.date}:${line.accountCode}:${side}`,
      });
    }
  }

  return [...buckets.values()].sort(
    (a, b) => a.date.localeCompare(b.date) || a.accountCode.localeCompare(b.accountCode),
  );
}

/** Drops zero-value lines, which carry no information and clutter an import. */
export function dropEmpty(lines: JournalLine[]): JournalLine[] {
  return lines.filter((l) => l.debit !== 0 || l.credit !== 0);
}

export function buildBatch(periodStart: string, periodEnd: string, lines: JournalLine[]): JournalBatch {
  const totalDebit  = lines.reduce((sum, l) => sum + l.debit, 0);
  const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0);
  return {
    periodStart,
    periodEnd,
    lines,
    totalDebit,
    totalCredit,
    balanced: totalDebit === totalCredit,
  };
}

/** Minor units → a plain decimal string for file output. Never localised. */
export function formatAmount(minorUnits: number): string {
  return (minorUnits / 100).toFixed(2);
}
