import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_OPERATIONAL_REMINDER_SETTINGS,
  getShiftReminderCandidates,
  readOperationalReminderSettings,
} from "./operationalReminders";

test("operational reminders default on with a 30-minute lead", () => {
  assert.deepEqual(readOperationalReminderSettings({}), DEFAULT_OPERATIONAL_REMINDER_SETTINGS);
});

test("current shift appears inside its configured reminder window", () => {
  const reminders = getShiftReminderCandidates({}, new Date("2026-07-30T08:40:00.000Z"));
  const morning = reminders.find((item) => item.shiftType === "MORNING");
  assert.equal(morning?.status, "DUE_SOON");
  assert.equal(morning?.minutesFromEnd, 20);
});

test("immediately previous shift remains overdue after the boundary", () => {
  const reminders = getShiftReminderCandidates({}, new Date("2026-07-30T09:10:00.000Z"));
  assert.deepEqual(
    reminders.map((item) => [item.shiftDate, item.shiftType, item.status]),
    [["2026-07-30", "MORNING", "OVERDUE"]],
  );
});

test("hotel can disable shift handover reminders", () => {
  assert.deepEqual(
    getShiftReminderCandidates(
      { shiftHandoverRemindersEnabled: false },
      new Date("2026-07-30T08:50:00.000Z"),
    ),
    [],
  );
});

test("hotel can extend the shift reminder lead time to 60 minutes", () => {
  const now = new Date("2026-07-30T08:15:00.000Z");
  assert.equal(getShiftReminderCandidates({}, now).some((item) => item.shiftType === "MORNING"), false);
  assert.equal(
    getShiftReminderCandidates({ shiftReminderLeadMinutes: 60 }, now)
      .some((item) => item.shiftType === "MORNING"),
    true,
  );
});
