// PKT is UTC+5. All date-range queries must use PKT midnight as boundaries,
// not UTC midnight. A UTC midnight boundary misattributes events in the
// 00:00–05:00 PKT window to the previous calendar day.

export const PKT_OFFSET_HOURS = 5;
const PKT_OFFSET_MS = PKT_OFFSET_HOURS * 60 * 60 * 1000;

export function getPKTDayRange(dateStr: string): { start: Date; end: Date } {
  const [y, m, d] = dateStr.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, d, 0, 0, 0) - PKT_OFFSET_MS);
  const end   = new Date(Date.UTC(y, m - 1, d + 1, 0, 0, 0) - PKT_OFFSET_MS);
  return { start, end };
}

export function getPKTRangeFromStrings(startDate: string, endDate: string): { start: Date; end: Date } {
  return {
    start: getPKTDayRange(startDate).start,
    end:   getPKTDayRange(endDate).end,
  };
}

export function getCurrentPKTDate(now = new Date()): string {
  const pktNow = new Date(now.getTime() + PKT_OFFSET_MS);
  return `${pktNow.getUTCFullYear()}-${String(pktNow.getUTCMonth() + 1).padStart(2, "0")}-${String(pktNow.getUTCDate()).padStart(2, "0")}`;
}

export function getPKTMonthRange(year: number, month: number): { start: Date; end: Date } {
  const firstDayStr = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const lastDayStr = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return {
    start: getPKTDayRange(firstDayStr).start,
    end:   getPKTDayRange(lastDayStr).end,
  };
}

/**
 * The instant a Postgres DATE column holds for a given calendar date.
 *
 * Prisma reads `@db.Date` columns back as UTC midnight, so date-only columns
 * (checkInDate, checkOutDate, scheduledDate) must be compared against UTC
 * midnight — NOT against getPKTDayRange, which returns PKT boundaries meant
 * for real timestamps. Mixing the two is what makes a stay look like it starts
 * a day early.
 */
export function dateOnlyUTC(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
}
