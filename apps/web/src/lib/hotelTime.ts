/**
 * Dates as the hotel sees them.
 *
 * `new Date().toISOString().slice(0, 10)` is the UTC date, which is the
 * PREVIOUS day for the first five hours of every Pakistani morning. Used as a
 * date picker's default it pre-fills yesterday; used as its `max` it stops a
 * night-shift clerk selecting today at all.
 *
 * This mirrors PKT_OFFSET_HOURS in apps/api/src/lib/timezone.ts. When the API
 * starts honouring the per-hotel `timezone` setting, this is the one place the
 * client needs to follow it.
 */
const HOTEL_TIME_ZONE = "Asia/Karachi";

/** Today's calendar date in the hotel's timezone, as "YYYY-MM-DD". */
export function todayInHotelTime(now: Date = new Date()): string {
  // "en-CA" formats as YYYY-MM-DD, which is exactly the shape date inputs want.
  return new Intl.DateTimeFormat("en-CA", { timeZone: HOTEL_TIME_ZONE }).format(now);
}

/** Minutes since midnight in the hotel's timezone — for positioning "now" on a clock axis. */
export function minutesIntoHotelDay(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: HOTEL_TIME_ZONE, hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(now);
  const hour   = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}
