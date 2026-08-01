import {
  getBusinessDayEnd,
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

export interface NightAuditReminderTiming {
  status: "DUE_SOON" | "OVERDUE";
  closesAt: Date;
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
 * Returns every elapsed shift for the active business date plus the current
 * shift when it enters the hotel's reminder window. Completion is checked
 * separately against shift_reports so an overdue handover remains visible.
 */
export function getShiftReminderCandidates(
  settings: unknown,
  now = new Date(),
  businessDate?: string,
): ShiftReminderCandidate[] {
  const reminderSettings = readOperationalReminderSettings(settings);
  if (!reminderSettings.shiftHandoverEnabled) return [];

  const current = getCurrentShiftContext(settings, now);
  const reminderDate = businessDate ?? current.shiftDate;
  const candidates: ShiftReminderCandidate[] = [];

  for (const shiftType of ["MORNING", "EVENING", "NIGHT"] as const) {
    const window = getShiftWindow(reminderDate, shiftType, current.schedule);
    if (now >= window.end) {
      candidates.push(candidate(
        reminderDate,
        shiftType,
        current.schedule,
        "OVERDUE",
        now,
      ));
      continue;
    }

    const leadStartsAt = new Date(
      window.end.getTime() - reminderSettings.shiftLeadMinutes * 60_000,
    );
    if (now >= leadStartsAt) {
      candidates.push(candidate(
        reminderDate,
        shiftType,
        current.schedule,
        "DUE_SOON",
        now,
      ));
    }
  }

  return candidates;
}

export function getNightAuditReminderTiming(
  settings: unknown,
  businessDate: string,
  now = new Date(),
): NightAuditReminderTiming | null {
  const reminderSettings = readOperationalReminderSettings(settings);
  if (!reminderSettings.nightAuditEnabled) return null;

  const closesAt = getBusinessDayEnd(businessDate, settings);
  const reminderStartsAt = new Date(
    closesAt.getTime() - reminderSettings.shiftLeadMinutes * 60_000,
  );
  if (now < reminderStartsAt) return null;

  return {
    status: now >= closesAt ? "OVERDUE" : "DUE_SOON",
    closesAt,
  };
}
