/**
 * Per-plan, per-date rate resolution for ARI.
 *
 * WHY THIS EXISTS, rather than calling RatePlanService.suggestRateCore:
 *
 * suggestRateCore answers "across all plans, what is the best rate for this
 * stay?" — it collapses every candidate into ONE winner and returns a single
 * suggestedRate. Channex asks the opposite question, independently per rate
 * plan: "for THIS rate plan, on THIS date, what is the rate?", because
 * /restrictions values are keyed by rate_plan_id. Pushing the winner's rate to
 * every provisioned plan would publish identical, and mostly wrong, prices.
 *
 * No pricing rule is reimplemented here. The eligibility predicate
 * (isActive / validFrom / validTo / daysOfWeek / minLos) is imported from
 * lib/companyRates.ts, the same one RatePlanService uses. The only thing added
 * is the per-date, per-plan framing.
 *
 * Note: rate_plans.modifier_type / modifier_value are NOT applied, because no
 * code in the PMS applies them — suggestRateCore returns rate_plan_items.rate
 * verbatim. OTA prices therefore match what Innflo quotes directly. See
 * PRODUCT_BACKLOG.md "Rate plan modifiers are configured but never applied".
 *
 * Pure — the caller does the queries and passes plans in.
 */

import { ratePlanAppliesToStay } from "./companyRates";
import { addDays, parseIsoDate, type DatedValue } from "./channexRanges";

export interface ResolvableRatePlan {
  id: string;
  isActive: boolean;
  validFrom: Date | null;
  validTo: Date | null;
  daysOfWeek: number[];
  minLos: number;
  /** room type id → rate in paisas, from rate_plan_items. */
  ratesByRoomTypeId: Map<string, number>;
}

/**
 * The rate this plan sells at for one room type on one date, or null when the
 * plan does not apply that day.
 *
 * Evaluated as a one-night stay: a nightly rate is exactly a plan that applies
 * to the single night beginning on `date`. minLos > 1 therefore excludes a plan
 * from per-date distribution entirely, which is correct — a minimum-stay rate
 * cannot be published as an unconditional nightly price.
 */
export function resolvePlanRateForDate(
  plan: ResolvableRatePlan,
  roomTypeId: string,
  date: string,
): number | null {
  const rate = plan.ratesByRoomTypeId.get(roomTypeId);
  if (rate === undefined) return null;

  const checkIn = parseIsoDate(date);
  const checkOut = parseIsoDate(addDays(date, 1));
  if (!ratePlanAppliesToStay(plan, checkIn, checkOut, 1)) return null;

  return rate;
}

/** What gets pushed for one rate plan on one date. */
export interface RateSeriesPoint {
  /** Paisas. Absent when the plan is closed that day. */
  rate: number | null;
  /** True when the plan does not apply — published as a closed day. */
  stopSell: boolean;
}

/**
 * The full per-date series for one (rate plan x room type) pair.
 *
 * Dates the plan does not cover are emitted as stop_sell rather than omitted.
 * Omitting them would leave whatever Channex last held for that date live on
 * every connected OTA — a stale price is worse than a closed day.
 */
export function buildRateSeries(
  plan: ResolvableRatePlan,
  roomTypeId: string,
  dates: string[],
): DatedValue<RateSeriesPoint>[] {
  return dates.map((date) => {
    const rate = resolvePlanRateForDate(plan, roomTypeId, date);
    return {
      date,
      value: rate === null
        ? { rate: null, stopSell: true }
        : { rate, stopSell: false },
    };
  });
}

/** Value equality for collapseRanges over a rate series. */
export function rateSeriesPointsEqual(a: RateSeriesPoint, b: RateSeriesPoint): boolean {
  return a.rate === b.rate && a.stopSell === b.stopSell;
}
