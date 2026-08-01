import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_SHIFT_SCHEDULE,
  getBusinessDayEnd,
  getCurrentShiftContext,
  getOperationalBusinessDate,
  getShiftWindow,
  hasBusinessDayEnded,
  isValidShiftSchedule,
  readShiftSchedule,
} from "./shiftSchedule";

test("uses InnFlo defaults when a hotel has no shift settings", () => {
  assert.deepEqual(readShiftSchedule({}), DEFAULT_SHIFT_SCHEDULE);
});

test("rejects overlapping or unordered tenant shift starts", () => {
  assert.equal(isValidShiftSchedule({
    morningStart: "14:00",
    eveningStart: "06:00",
    nightStart: "22:00",
  }), false);
});

test("night shift after midnight belongs to the previous operating date", () => {
  const context = getCurrentShiftContext(
    {},
    new Date("2026-07-30T00:30:00.000Z"), // 05:30 PKT
  );
  assert.equal(context.shiftType, "NIGHT");
  assert.equal(context.shiftDate, "2026-07-29");
});

test("operating date remains on the previous day until Morning begins", () => {
  assert.equal(
    getOperationalBusinessDate({}, new Date("2026-07-31T00:30:00.000Z")),
    "2026-07-30",
  );
});

test("business day ends at the following configured Morning boundary", () => {
  assert.equal(
    getBusinessDayEnd("2026-07-30", {}).toISOString(),
    "2026-07-31T01:00:00.000Z",
  );
  assert.equal(
    hasBusinessDayEnded("2026-07-30", {}, new Date("2026-07-31T00:59:59.999Z")),
    false,
  );
  assert.equal(
    hasBusinessDayEnded("2026-07-30", {}, new Date("2026-07-31T01:00:00.000Z")),
    true,
  );
});

test("custom schedule produces contiguous PKT windows", () => {
  const schedule = {
    morningStart: "07:00",
    eveningStart: "15:00",
    nightStart: "23:00",
  };
  const morning = getShiftWindow("2026-07-30", "MORNING", schedule);
  const evening = getShiftWindow("2026-07-30", "EVENING", schedule);
  const night = getShiftWindow("2026-07-30", "NIGHT", schedule);
  assert.equal(morning.end.toISOString(), evening.start.toISOString());
  assert.equal(evening.end.toISOString(), night.start.toISOString());
  assert.equal(night.end.toISOString(), "2026-07-31T02:00:00.000Z");
});
