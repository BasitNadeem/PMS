import {
  getCurrentShiftContext,
  getShiftWindow,
  type ShiftSchedule,
  type ShiftType,
} from "./shiftSchedule";

export type ShiftReminderStatus = "DUE_SOON" | "OVERDUE";

export interface OperationalReminderSettings {
  shiftHandoverEnabled: boolean;
  nightAuditEnabled: boolean;
  shiftLeadMinutes: 15 | 30 | 60;
}

export interface ShiftReminderCandidate {
  id: string;
  shiftDate: string;
  shiftType: ShiftType;
  status: ShiftReminderStatus;
  endsAt: Date;
  minutesFromEnd: number;
}

export const DEFAULT_OPERATIONAL_REMINDER_SETTINGS: OperationalReminderSettings = {
  shiftHandoverEnabled: true,
  nightAuditEnabled: true,
  shiftLeadMinutes: 30,
};

export function readOperationalReminderSettings(settings: unknown): OperationalReminderSettings {
  const values = settings && typeof settings === "object"
    ? settings as Record<string, unknown>
    : {};
  const lead = values.shiftReminderLeadMinutes;

  return {
    shiftHandoverEnabled: values.shiftHandoverRemindersEnabled !== false,
    nightAuditEnabled: values.nightAuditRemindersEnabled !== false,
    shiftLeadMinutes: lead === 15 || lead === 30 || lead === 60 ? lead : 30,
  };
}

function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + days));
  return [
    value.getUTCFullYear(),
    String(value.getUTCMonth() + 1).padStart(2, "0"),
    String(value.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function previousShift(
  shiftDate: string,
  shiftType: ShiftType,
): { shiftDate: string; shiftType: ShiftType } {
  if (shiftType === "EVENING") return { shiftDate, shiftType: "MORNING" };
  if (shiftType === "NIGHT") return { shiftDate, shiftType: "EVENING" };
  return { shiftDate: addDays(shiftDate, -1), shiftType: "NIGHT" };
}

function candidate(
  shiftDate: string,
  shiftType: ShiftType,
  schedule: ShiftSchedule,
  status: ShiftReminderStatus,
  now: Date,
): ShiftReminderCandidate {
  const endsAt = getShiftWindow(shiftDate, shiftType, schedule).end;
  return {
    id: `shift:${shiftDate}:${shiftType}`,
    shiftDate,
    shiftType,
    status,
    endsAt,
    minutesFromEnd: Math.max(0, Math.ceil(Math.abs(endsAt.getTime() - now.getTime()) / 60_000)),
  };
}

/**
 * Returns at most the immediately previous overdue shift and the current shift
 * when it is inside the hotel's configured reminder window. Completion is
 * checked separately against shift_reports so this remains deterministic.
 */
export function getShiftReminderCandidates(
  settings: unknown,
  now = new Date(),
): ShiftReminderCandidate[] {
  const reminderSettings = readOperationalReminderSettings(settings);
  if (!reminderSettings.shiftHandoverEnabled) return [];

  const current = getCurrentShiftContext(settings, now);
  const currentWindow = getShiftWindow(current.shiftDate, current.shiftType, current.schedule);
  const previous = previousShift(current.shiftDate, current.shiftType);
  const previousWindow = getShiftWindow(previous.shiftDate, previous.shiftType, current.schedule);
  const candidates: ShiftReminderCandidate[] = [];

  if (now >= previousWindow.end) {
    candidates.push(candidate(
      previous.shiftDate,
      previous.shiftType,
      current.schedule,
      "OVERDUE",
      now,
    ));
  }

  const leadStartsAt = new Date(
    currentWindow.end.getTime() - reminderSettings.shiftLeadMinutes * 60_000,
  );
  if (now >= leadStartsAt && now < currentWindow.end) {
    candidates.push(candidate(
      current.shiftDate,
      current.shiftType,
      current.schedule,
      "DUE_SOON",
      now,
    ));
  }

  return candidates;
}
