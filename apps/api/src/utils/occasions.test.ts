import assert from "node:assert/strict";
import test from "node:test";
import { upcomingWindow, isLeapDayObservedOn, isLeapYear, occurrenceNumber, formatMonthDay } from "./occasions";

test("the window starts today and covers the requested span inclusively", () => {
  const window = upcomingWindow(new Date(Date.UTC(2026, 7, 1)), 3);
  assert.equal(window.length, 4);
  assert.deepEqual(window[0], { month: 8, day: 1, inDays: 0 });
  assert.deepEqual(window[3], { month: 8, day: 4, inDays: 3 });
});

test("the window rolls over a month boundary", () => {
  const window = upcomingWindow(new Date(Date.UTC(2026, 0, 30)), 3);
  assert.deepEqual(window.map((w) => `${w.month}/${w.day}`), ["1/30", "1/31", "2/1", "2/2"]);
});

test("the window rolls over a year boundary", () => {
  const window = upcomingWindow(new Date(Date.UTC(2026, 11, 30)), 2);
  assert.deepEqual(window.map((w) => `${w.month}/${w.day}`), ["12/30", "12/31", "1/1"]);
});

test("a leap year keeps 29 February in the window", () => {
  const window = upcomingWindow(new Date(Date.UTC(2028, 1, 28)), 1);
  assert.deepEqual(window.map((w) => `${w.month}/${w.day}`), ["2/28", "2/29"]);
});

test("leap years are identified by the full rule, including centuries", () => {
  assert.equal(isLeapYear(2024), true);
  assert.equal(isLeapYear(2026), false);
  assert.equal(isLeapYear(1900), false); // divisible by 100, not by 400
  assert.equal(isLeapYear(2000), true);  // divisible by 400
});

test("a 29 February birthday is observed on the 28th in a non-leap year", () => {
  assert.equal(isLeapDayObservedOn(new Date(Date.UTC(2026, 1, 28)), 2, 29), true);
});

test("a 29 February birthday is not moved in a leap year", () => {
  assert.equal(isLeapDayObservedOn(new Date(Date.UTC(2028, 1, 28)), 2, 29), false);
});

test("only 29 February occasions get the fallback", () => {
  assert.equal(isLeapDayObservedOn(new Date(Date.UTC(2026, 1, 28)), 2, 28), false);
  assert.equal(isLeapDayObservedOn(new Date(Date.UTC(2026, 1, 28)), 8, 14), false);
});

test("the occurrence number is omitted when the guest withheld the year", () => {
  assert.equal(occurrenceNumber(null, new Date(Date.UTC(2026, 7, 14))), null);
});

test("the occurrence number counts years elapsed", () => {
  assert.equal(occurrenceNumber(2020, new Date(Date.UTC(2026, 7, 14))), 6);
});

test("a year in the future yields no occurrence rather than a negative one", () => {
  assert.equal(occurrenceNumber(2030, new Date(Date.UTC(2026, 7, 14))), null);
  assert.equal(occurrenceNumber(2026, new Date(Date.UTC(2026, 7, 14))), null);
});

test("month/day formats without a year, including 29 February", () => {
  assert.equal(formatMonthDay(8, 14), "14 August");
  assert.equal(formatMonthDay(2, 29), "29 February");
});
