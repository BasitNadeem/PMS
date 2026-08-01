/**
 * Calendar helpers for birthdays and anniversaries.
 *
 * Kept free of `@pms/db` imports so the date arithmetic can be unit-tested
 * without a database connection.
 */

/** Month/day pairs that fall within the next `withinDays`, wrapping past year end. */
export interface UpcomingWindowEntry {
  month: number;
  day:   number;
  /** 0 = today, 1 = tomorrow, … */
  inDays: number;
}

const MS_PER_DAY = 86_400_000;

/**
 * Builds the list of month/day pairs to look for, starting today.
 *
 * Working forwards from real dates rather than doing modular arithmetic on
 * month/day means year boundaries and leap years are handled by the calendar
 * itself instead of by hand.
 */
export function upcomingWindow(from: Date, withinDays: number): UpcomingWindowEntry[] {
  const entries: UpcomingWindowEntry[] = [];
  for (let offset = 0; offset <= withinDays; offset++) {
    const d = new Date(from.getTime() + offset * MS_PER_DAY);
    entries.push({ month: d.getUTCMonth() + 1, day: d.getUTCDate(), inDays: offset });
  }
  return entries;
}

/**
 * True when a February 29 occasion should be observed on this date because the
 * current year has no 29th.
 *
 * Without this, guests born on a leap day are silently skipped in three years
 * out of four. They are greeted on the 28th instead.
 */
export function isLeapDayObservedOn(date: Date, month: number, day: number): boolean {
  if (month !== 2 || day !== 29) return false;
  if (date.getUTCMonth() + 1 !== 2 || date.getUTCDate() !== 28) return false;
  return !isLeapYear(date.getUTCFullYear());
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Which anniversary this is, when the year is known. Returns null when the
 * guest withheld the year — the greeting then omits the number rather than
 * guessing one.
 */
export function occurrenceNumber(year: number | null, on: Date): number | null {
  if (year === null) return null;
  const n = on.getUTCFullYear() - year;
  return n > 0 ? n : null;
}

/** "14 August", used in greeting copy and the front-desk list. */
export function formatMonthDay(month: number, day: number): string {
  const formatter = new Intl.DateTimeFormat("en-PK", { day: "numeric", month: "long", timeZone: "UTC" });
  // Year is arbitrary here; a leap year is used so 29 February formats.
  return formatter.format(new Date(Date.UTC(2024, month - 1, day)));
}
