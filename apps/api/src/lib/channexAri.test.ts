import assert from "node:assert/strict";
import test from "node:test";
import { computeAvailability, type OccupancySpan } from "./channexOccupancy";
import {
  resolvePlanRateForDate, buildRateSeries, rateSeriesPointsEqual,
  type ResolvableRatePlan,
} from "./channexRates";
import { collapseRanges, eachDate } from "./channexRanges";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

// ── Availability ─────────────────────────────────────────────────────────────

function availabilityFor(spans: OccupancySpan[], total = 3, dates = eachDate("2026-01-01", "2026-01-05")) {
  const result = computeAvailability({
    dates,
    roomCountsByType: new Map([["rt-1", total]]),
    spans,
  });
  return result.get("rt-1")!;
}

test("with no reservations every date shows the full room count", () => {
  const byDate = availabilityFor([]);
  for (const date of eachDate("2026-01-01", "2026-01-05")) {
    assert.equal(byDate.get(date), 3, `wrong availability on ${date}`);
  }
});

test("a stay occupies arrival night through the night before departure", () => {
  const byDate = availabilityFor([
    { roomTypeId: "rt-1", checkInDate: d("2026-01-02"), checkOutDate: d("2026-01-04") },
  ]);
  assert.equal(byDate.get("2026-01-01"), 3);
  assert.equal(byDate.get("2026-01-02"), 2); // arrival — occupied
  assert.equal(byDate.get("2026-01-03"), 2); // occupied
  assert.equal(byDate.get("2026-01-04"), 3); // departure — resold same day
  assert.equal(byDate.get("2026-01-05"), 3);
});

test("a same-day turnover does not double count", () => {
  // One guest leaves on the 3rd, another arrives the 3rd: one room used, not two.
  const byDate = availabilityFor([
    { roomTypeId: "rt-1", checkInDate: d("2026-01-01"), checkOutDate: d("2026-01-03") },
    { roomTypeId: "rt-1", checkInDate: d("2026-01-03"), checkOutDate: d("2026-01-05") },
  ]);
  assert.equal(byDate.get("2026-01-02"), 2);
  assert.equal(byDate.get("2026-01-03"), 2);
  assert.equal(byDate.get("2026-01-04"), 2);
});

test("concurrent stays stack", () => {
  const byDate = availabilityFor([
    { roomTypeId: "rt-1", checkInDate: d("2026-01-02"), checkOutDate: d("2026-01-04") },
    { roomTypeId: "rt-1", checkInDate: d("2026-01-02"), checkOutDate: d("2026-01-04") },
  ]);
  assert.equal(byDate.get("2026-01-02"), 1);
  assert.equal(byDate.get("2026-01-03"), 1);
});

test("availability floors at zero when overbooked", () => {
  // Never emit a negative — Channex would reject the whole batch.
  const byDate = availabilityFor([
    { roomTypeId: "rt-1", checkInDate: d("2026-01-02"), checkOutDate: d("2026-01-03") },
    { roomTypeId: "rt-1", checkInDate: d("2026-01-02"), checkOutDate: d("2026-01-03") },
    { roomTypeId: "rt-1", checkInDate: d("2026-01-02"), checkOutDate: d("2026-01-03") },
    { roomTypeId: "rt-1", checkInDate: d("2026-01-02"), checkOutDate: d("2026-01-03") },
  ], 3);
  assert.equal(byDate.get("2026-01-02"), 0);
});

test("a stay overhanging the window only affects dates inside it", () => {
  const byDate = availabilityFor([
    { roomTypeId: "rt-1", checkInDate: d("2025-12-20"), checkOutDate: d("2026-01-03") },
  ]);
  assert.equal(byDate.get("2026-01-01"), 2);
  assert.equal(byDate.get("2026-01-02"), 2);
  assert.equal(byDate.get("2026-01-03"), 3);
});

test("room types are counted independently", () => {
  const result = computeAvailability({
    dates: eachDate("2026-01-01", "2026-01-02"),
    roomCountsByType: new Map([["rt-1", 2], ["rt-2", 5]]),
    spans: [{ roomTypeId: "rt-1", checkInDate: d("2026-01-01"), checkOutDate: d("2026-01-02") }],
  });
  assert.equal(result.get("rt-1")!.get("2026-01-01"), 1);
  assert.equal(result.get("rt-2")!.get("2026-01-01"), 5);
});

test("a room type with zero rooms reports zero, not absent", () => {
  const result = computeAvailability({
    dates: ["2026-01-01"],
    roomCountsByType: new Map([["rt-1", 0]]),
    spans: [],
  });
  assert.equal(result.get("rt-1")!.get("2026-01-01"), 0);
});

test("a dated inventory block removes one room for each blocked night", () => {
  const result = computeAvailability({
    dates: eachDate("2026-01-01", "2026-01-05"),
    roomCountsByType: new Map([["rt-1", 3]]),
    spans: [],
    blocks: [{ roomTypeId: "rt-1", startDate: d("2026-01-02"), endDate: d("2026-01-04") }],
  });
  const byDate = result.get("rt-1")!;
  assert.equal(byDate.get("2026-01-01"), 3);
  assert.equal(byDate.get("2026-01-02"), 2);
  assert.equal(byDate.get("2026-01-03"), 2);
  assert.equal(byDate.get("2026-01-04"), 3);
});

test("reservations and inventory blocks both consume room-type availability", () => {
  const result = computeAvailability({
    dates: ["2026-01-02"],
    roomCountsByType: new Map([["rt-1", 3]]),
    spans: [{ roomTypeId: "rt-1", checkInDate: d("2026-01-02"), checkOutDate: d("2026-01-03") }],
    blocks: [{ roomTypeId: "rt-1", startDate: d("2026-01-02"), endDate: d("2026-01-03") }],
  });
  assert.equal(result.get("rt-1")!.get("2026-01-02"), 1);
});

// ── Rate resolution ──────────────────────────────────────────────────────────

function plan(overrides: Partial<ResolvableRatePlan> = {}): ResolvableRatePlan {
  return {
    id: "plan-1",
    isActive: true,
    validFrom: null,
    validTo: null,
    daysOfWeek: [],
    minLos: 1,
    ratesByRoomTypeId: new Map([["rt-1", 500_000]]),
    ...overrides,
  };
}

test("an open-ended active plan resolves on any date", () => {
  assert.equal(resolvePlanRateForDate(plan(), "rt-1", "2026-06-15"), 500_000);
});

test("a plan with no rate for the room type resolves to null", () => {
  assert.equal(resolvePlanRateForDate(plan(), "rt-99", "2026-06-15"), null);
});

test("an inactive plan never resolves", () => {
  assert.equal(resolvePlanRateForDate(plan({ isActive: false }), "rt-1", "2026-06-15"), null);
});

test("validity bounds are respected per date", () => {
  const seasonal = plan({ validFrom: d("2026-06-01"), validTo: d("2026-06-30") });
  assert.equal(resolvePlanRateForDate(seasonal, "rt-1", "2026-05-31"), null);
  assert.equal(resolvePlanRateForDate(seasonal, "rt-1", "2026-06-01"), 500_000);
  assert.equal(resolvePlanRateForDate(seasonal, "rt-1", "2026-06-30"), 500_000);
  assert.equal(resolvePlanRateForDate(seasonal, "rt-1", "2026-07-01"), null);
});

test("weekday restrictions apply per night", () => {
  // 2026-06-13 is a Saturday, 2026-06-14 a Sunday (UTC).
  assert.equal(new Date("2026-06-13T00:00:00.000Z").getUTCDay(), 6);
  const weekend = plan({ daysOfWeek: [6, 0] });
  assert.equal(resolvePlanRateForDate(weekend, "rt-1", "2026-06-13"), 500_000);
  assert.equal(resolvePlanRateForDate(weekend, "rt-1", "2026-06-14"), 500_000);
  assert.equal(resolvePlanRateForDate(weekend, "rt-1", "2026-06-15"), null); // Monday
});

test("a minimum-stay plan is not publishable as a nightly rate", () => {
  // A 3-night minimum cannot be an unconditional per-night price.
  assert.equal(resolvePlanRateForDate(plan({ minLos: 3 }), "rt-1", "2026-06-15"), null);
  assert.equal(resolvePlanRateForDate(plan({ minLos: 1 }), "rt-1", "2026-06-15"), 500_000);
});

test("dates a plan does not cover become stop_sell, never omitted", () => {
  // Omitting would leave a stale price live on every connected OTA.
  const series = buildRateSeries(
    plan({ validFrom: d("2026-06-02"), validTo: d("2026-06-03") }),
    "rt-1",
    eachDate("2026-06-01", "2026-06-04"),
  );
  assert.equal(series.length, 4);
  assert.deepEqual(series[0].value, { rate: null, stopSell: true });
  assert.deepEqual(series[1].value, { rate: 500_000, stopSell: false });
  assert.deepEqual(series[2].value, { rate: 500_000, stopSell: false });
  assert.deepEqual(series[3].value, { rate: null, stopSell: true });
});

test("a rate series collapses into open and closed ranges", () => {
  const series = buildRateSeries(
    plan({ daysOfWeek: [1, 2, 3, 4, 5] }), // weekdays only
    "rt-1",
    eachDate("2026-06-08", "2026-06-14"), // Mon..Sun
  );
  const collapsed = collapseRanges(series, rateSeriesPointsEqual);
  assert.deepEqual(collapsed, [
    { date_from: "2026-06-08", date_to: "2026-06-12", value: { rate: 500_000, stopSell: false } },
    { date_from: "2026-06-13", date_to: "2026-06-14", value: { rate: null, stopSell: true } },
  ]);
});

test("a year on an unchanging plan collapses to one payload row", () => {
  const series = buildRateSeries(plan(), "rt-1", eachDate("2026-01-01", "2026-12-31"));
  assert.equal(series.length, 365);
  assert.equal(collapseRanges(series, rateSeriesPointsEqual).length, 1);
});
