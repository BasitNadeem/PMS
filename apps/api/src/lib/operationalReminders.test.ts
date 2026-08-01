import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_OPERATIONAL_REMINDER_SETTINGS,
  getNightAuditReminderTiming,
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

test("all incomplete handovers remain candidates through the business date", () => {
  const reminders = getShiftReminderCandidates(
    {},
    new Date("2026-07-30T17:10:00.000Z"), // 22:10 PKT
    "2026-07-30",
  );
  assert.deepEqual(
    reminders.map((item) => [item.shiftType, item.status]),
    [
      ["MORNING", "OVERDUE"],
      ["EVENING", "OVERDUE"],
    ],
  );
});

test("Night handover becomes due before the next Morning boundary", () => {
  const reminders = getShiftReminderCandidates(
    {},
    new Date("2026-07-31T00:40:00.000Z"), // 05:40 PKT
    "2026-07-30",
  );
  assert.deepEqual(
    reminders.map((item) => [item.shiftType, item.status]),
    [
      ["MORNING", "OVERDUE"],
      ["EVENING", "OVERDUE"],
      ["NIGHT", "DUE_SOON"],
    ],
  );
});

test("Night Audit prepares before business-day end and becomes overdue at Morning", () => {
  assert.equal(
    getNightAuditReminderTiming({}, "2026-07-30", new Date("2026-07-31T00:29:59.999Z")),
    null,
  );
  assert.equal(
    getNightAuditReminderTiming({}, "2026-07-30", new Date("2026-07-31T00:30:00.000Z"))?.status,
    "DUE_SOON",
  );
  assert.equal(
    getNightAuditReminderTiming({}, "2026-07-30", new Date("2026-07-31T01:00:00.000Z"))?.status,
    "OVERDUE",
  );
});

test("Night Audit follows a hotel's custom Morning boundary", () => {
  const settings = {
    shiftMorningStart: "07:00",
    shiftEveningStart: "15:00",
    shiftNightStart: "23:00",
  };
  const timing = getNightAuditReminderTiming(
    settings,
    "2026-07-30",
    new Date("2026-07-31T01:30:00.000Z"), // 06:30 PKT
  );
  assert.equal(timing?.status, "DUE_SOON");
  assert.equal(timing?.closesAt.toISOString(), "2026-07-31T02:00:00.000Z");
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
