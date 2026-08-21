/**
 * Date helpers and contiguous-range collapsing for ARI payloads.
 *
 * Collapsing is mandatory, not an optimisation. Channex allows 10 availability
 * and 10 restriction requests per minute PER PROPERTY, with a 10MB ceiling per
 * call. A year of per-date entries for 5 room types is 1,825 rows; the same
 * data expressed as ranges is usually a handful, because availability and rates
 * only change on the days something actually happens.
 *
 * Pure — no I/O, no clock. Every function takes and returns ISO YYYY-MM-DD.
 */

const MS_PER_DAY = 86_400_000;

/** YYYY-MM-DD, validated. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function assertIsoDate(date: string): void {
  if (!ISO_DATE.test(date)) {
    throw new TypeError(`Expected an ISO YYYY-MM-DD date, got "${date}"`);
  }
}

/** Parses to UTC midnight — DATE columns carry no zone, so UTC keeps it stable. */
export function parseIsoDate(date: string): Date {
  assertIsoDate(date);
  return new Date(`${date}T00:00:00.000Z`);
}

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  return toIsoDate(new Date(parseIsoDate(date).getTime() + days * MS_PER_DAY));
}

/** Whole days between two ISO dates; negative when `to` precedes `from`. */
export function daysBetween(from: string, to: string): number {
  return Math.round((parseIsoDate(to).getTime() - parseIsoDate(from).getTime()) / MS_PER_DAY);
}

/** Every date from `from` to `to`, inclusive of both. Empty if `to` < `from`. */
export function eachDate(from: string, to: string): string[] {
  const span = daysBetween(from, to);
  if (span < 0) return [];
  const dates: string[] = [];
  for (let offset = 0; offset <= span; offset += 1) dates.push(addDays(from, offset));
  return dates;
}

export interface DatedValue<T> {
  date: string;
  value: T;
}

export interface CollapsedRange<T> {
  date_from: string;
  date_to: string;
  value: T;
}

/**
 * Collapses per-date values into the fewest contiguous equal-valued ranges.
 *
 * A range breaks on either a value change or a gap in dates — a gap must not be
 * silently bridged, or a date nobody asked about would be overwritten.
 * Duplicate dates keep the first value seen.
 *
 * @param isEqual  supply for object values; the default is strict equality.
 */
export function collapseRanges<T>(
  entries: DatedValue<T>[],
  isEqual: (a: T, b: T) => boolean = (a, b) => a === b,
): CollapsedRange<T>[] {
  if (entries.length === 0) return [];

  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const ranges: CollapsedRange<T>[] = [];

  let start = sorted[0].date;
  let previous = sorted[0].date;
  let value = sorted[0].value;

  for (let index = 1; index < sorted.length; index += 1) {
    const entry = sorted[index];
    if (entry.date === previous) continue; // duplicate date — first value wins

    const contiguous = entry.date === addDays(previous, 1);
    if (contiguous && isEqual(entry.value, value)) {
      previous = entry.date;
      continue;
    }

    ranges.push({ date_from: start, date_to: previous, value });
    start = entry.date;
    previous = entry.date;
    value = entry.value;
  }

  ranges.push({ date_from: start, date_to: previous, value });
  return ranges;
}
