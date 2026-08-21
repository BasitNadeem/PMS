/**
 * Today's date in the hotel's operating timezone as `YYYY-MM-DD`.
 *
 * Business rules that compare against "today" — no-show eligibility being the
 * one that matters most — must agree with the API, which resolves the same
 * question against the hotel's business date in PKT. Using the browser's local
 * date would let a user in another timezone see an action the server rejects.
 */
export function currentPKTDate(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}
