import assert from "node:assert/strict";
import test from "node:test";
import {
  addDays, daysBetween, eachDate, collapseRanges, parseIsoDate, toIsoDate,
} from "./channexRanges";

test("date arithmetic stays in UTC across a DST boundary", () => {
  // 2026-03-29 is when most of Europe springs forward; UTC must not shift.
  assert.equal(addDays("2026-03-28", 1), "2026-03-29");
  assert.equal(addDays("2026-03-29", 1), "2026-03-30");
  assert.equal(addDays("2026-10-24", 3), "2026-10-27");
});

test("date arithmetic crosses month and year boundaries", () => {
  assert.equal(addDays("2026-01-31", 1), "2026-02-01");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2028-02-28", 1), "2028-02-29"); // leap year
  assert.equal(addDays("2026-01-01", -1), "2025-12-31");
});

test("daysBetween counts whole days in both directions", () => {
  assert.equal(daysBetween("2026-01-01", "2026-01-01"), 0);
  assert.equal(daysBetween("2026-01-01", "2026-01-31"), 30);
  assert.equal(daysBetween("2026-01-31", "2026-01-01"), -30);
});

test("eachDate is inclusive of both ends", () => {
  assert.deepEqual(eachDate("2026-01-01", "2026-01-04"),
    ["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04"]);
  assert.deepEqual(eachDate("2026-01-01", "2026-01-01"), ["2026-01-01"]);
  assert.deepEqual(eachDate("2026-01-05", "2026-01-01"), []);
});

test("round-trips through Date without drifting", () => {
  assert.equal(toIsoDate(parseIsoDate("2026-08-09")), "2026-08-09");
});

test("rejects a malformed date", () => {
  for (const bad of ["2026-8-9", "09-08-2026", "2026/08/09", "", "today"]) {
    assert.throws(() => parseIsoDate(bad), TypeError, `expected "${bad}" to be rejected`);
  }
});

// ── collapseRanges ───────────────────────────────────────────────────────────

test("collapses a run of equal values into one range", () => {
  const collapsed = collapseRanges([
    { date: "2026-01-01", value: 5 },
    { date: "2026-01-02", value: 5 },
    { date: "2026-01-03", value: 5 },
  ]);
  assert.deepEqual(collapsed, [{ date_from: "2026-01-01", date_to: "2026-01-03", value: 5 }]);
});

test("breaks a range when the value changes", () => {
  const collapsed = collapseRanges([
    { date: "2026-01-01", value: 5 },
    { date: "2026-01-02", value: 5 },
    { date: "2026-01-03", value: 3 },
    { date: "2026-01-04", value: 5 },
  ]);
  assert.deepEqual(collapsed, [
    { date_from: "2026-01-01", date_to: "2026-01-02", value: 5 },
    { date_from: "2026-01-03", date_to: "2026-01-03", value: 3 },
    { date_from: "2026-01-04", date_to: "2026-01-04", value: 5 },
  ]);
});

test("never bridges a gap in dates, even when values match", () => {
  // Bridging would overwrite 2026-01-03, a date the caller said nothing about.
  const collapsed = collapseRanges([
    { date: "2026-01-01", value: 5 },
    { date: "2026-01-02", value: 5 },
    { date: "2026-01-04", value: 5 },
  ]);
  assert.deepEqual(collapsed, [
    { date_from: "2026-01-01", date_to: "2026-01-02", value: 5 },
    { date_from: "2026-01-04", date_to: "2026-01-04", value: 5 },
  ]);
});

test("sorts unordered input before collapsing", () => {
  const collapsed = collapseRanges([
    { date: "2026-01-03", value: 7 },
    { date: "2026-01-01", value: 7 },
    { date: "2026-01-02", value: 7 },
  ]);
  assert.deepEqual(collapsed, [{ date_from: "2026-01-01", date_to: "2026-01-03", value: 7 }]);
});

test("handles empty and single-entry input", () => {
  assert.deepEqual(collapseRanges([]), []);
  assert.deepEqual(collapseRanges([{ date: "2026-01-01", value: 1 }]),
    [{ date_from: "2026-01-01", date_to: "2026-01-01", value: 1 }]);
});

test("keeps the first value on a duplicate date", () => {
  const collapsed = collapseRanges([
    { date: "2026-01-01", value: 5 },
    { date: "2026-01-01", value: 9 },
    { date: "2026-01-02", value: 5 },
  ]);
  assert.deepEqual(collapsed, [{ date_from: "2026-01-01", date_to: "2026-01-02", value: 5 }]);
});

test("collapses object values with a custom comparator", () => {
  const collapsed = collapseRanges(
    [
      { date: "2026-01-01", value: { rate: 500_000, stopSell: false } },
      { date: "2026-01-02", value: { rate: 500_000, stopSell: false } },
      { date: "2026-01-03", value: { rate: null, stopSell: true } },
    ],
    (a, b) => a.rate === b.rate && a.stopSell === b.stopSell,
  );
  assert.equal(collapsed.length, 2);
  assert.deepEqual(collapsed[0], {
    date_from: "2026-01-01", date_to: "2026-01-02", value: { rate: 500_000, stopSell: false },
  });
});

test("object values without a comparator do not collapse (identity equality)", () => {
  // Guards against forgetting isEqual and silently sending 365 rows.
  const collapsed = collapseRanges([
    { date: "2026-01-01", value: { rate: 1 } },
    { date: "2026-01-02", value: { rate: 1 } },
  ]);
  assert.equal(collapsed.length, 2);
});

test("a full year of one unchanging value collapses to a single range", () => {
  // The behaviour the rate limit depends on: 365 entries -> 1 payload row.
  const entries = eachDate("2026-01-01", "2026-12-31").map((date) => ({ date, value: 4 }));
  assert.equal(entries.length, 365);
  const collapsed = collapseRanges(entries);
  assert.deepEqual(collapsed, [{ date_from: "2026-01-01", date_to: "2026-12-31", value: 4 }]);
});

test("a year with one changed day collapses to three ranges", () => {
  const entries = eachDate("2026-01-01", "2026-12-31").map((date) => ({
    date, value: date === "2026-07-04" ? 0 : 4,
  }));
  const collapsed = collapseRanges(entries);
  assert.deepEqual(collapsed, [
    { date_from: "2026-01-01", date_to: "2026-07-03", value: 4 },
    { date_from: "2026-07-04", date_to: "2026-07-04", value: 0 },
    { date_from: "2026-07-05", date_to: "2026-12-31", value: 4 },
  ]);
});

test("alternating values do not collapse and are reported honestly", () => {
  const entries = eachDate("2026-01-01", "2026-01-10").map((date, index) => ({
    date, value: index % 2,
  }));
  assert.equal(collapseRanges(entries).length, 10);
});
