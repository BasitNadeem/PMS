import { PKT_OFFSET_HOURS } from "./timezone";

export type ShiftType = "MORNING" | "EVENING" | "NIGHT";

export interface ShiftSchedule {
  morningStart: string;
  eveningStart: string;
  nightStart: string;
}

export const DEFAULT_SHIFT_SCHEDULE: ShiftSchedule = {
  morningStart: "06:00",
  eveningStart: "14:00",
  nightStart: "22:00",
};

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const PKT_OFFSET_MS = PKT_OFFSET_HOURS * 60 * 60 * 1000;

export function timeToMinutes(value: string): number {
  const match = TIME_PATTERN.exec(value);
  if (!match) return -1;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function isValidShiftSchedule(schedule: ShiftSchedule): boolean {
  const morning = timeToMinutes(schedule.morningStart);
  const evening = timeToMinutes(schedule.eveningStart);
  const night = timeToMinutes(schedule.nightStart);
  return morning >= 0 && morning < evening && evening < night;
}

export function readShiftSchedule(settings: unknown): ShiftSchedule {
  const values = settings && typeof settings === "object"
    ? settings as Record<string, unknown>
    : {};
  const candidate: ShiftSchedule = {
    morningStart: typeof values.shiftMorningStart === "string"
      ? values.shiftMorningStart
      : DEFAULT_SHIFT_SCHEDULE.morningStart,
    eveningStart: typeof values.shiftEveningStart === "string"
      ? values.shiftEveningStart
      : DEFAULT_SHIFT_SCHEDULE.eveningStart,
    nightStart: typeof values.shiftNightStart === "string"
      ? values.shiftNightStart
      : DEFAULT_SHIFT_SCHEDULE.nightStart,
  };
  return isValidShiftSchedule(candidate) ? candidate : DEFAULT_SHIFT_SCHEDULE;
}

export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + days));
  return [
    value.getUTCFullYear(),
    String(value.getUTCMonth() + 1).padStart(2, "0"),
    String(value.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function pktDateAt(date: string, time: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  const minutes = timeToMinutes(time);
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - PKT_OFFSET_MS);
}

export function getShiftWindow(
  date: string,
  shiftType: ShiftType,
  schedule: ShiftSchedule,
): { start: Date; end: Date } {
  if (shiftType === "MORNING") {
    return {
      start: pktDateAt(date, schedule.morningStart),
      end: pktDateAt(date, schedule.eveningStart),
    };
  }
  if (shiftType === "EVENING") {
    return {
      start: pktDateAt(date, schedule.eveningStart),
      end: pktDateAt(date, schedule.nightStart),
    };
  }
  return {
    start: pktDateAt(date, schedule.nightStart),
    end: pktDateAt(addDays(date, 1), schedule.morningStart),
  };
}

export function getCurrentShiftContext(
  settings: unknown,
  now = new Date(),
): { shiftDate: string; shiftType: ShiftType; schedule: ShiftSchedule } {
  const schedule = readShiftSchedule(settings);
  const pktNow = new Date(now.getTime() + PKT_OFFSET_MS);
  const minutes = pktNow.getUTCHours() * 60 + pktNow.getUTCMinutes();
  const morning = timeToMinutes(schedule.morningStart);
  const evening = timeToMinutes(schedule.eveningStart);
  const night = timeToMinutes(schedule.nightStart);
  const today = [
    pktNow.getUTCFullYear(),
    String(pktNow.getUTCMonth() + 1).padStart(2, "0"),
    String(pktNow.getUTCDate()).padStart(2, "0"),
  ].join("-");

  if (minutes >= morning && minutes < evening) {
    return { shiftDate: today, shiftType: "MORNING", schedule };
  }
  if (minutes >= evening && minutes < night) {
    return { shiftDate: today, shiftType: "EVENING", schedule };
  }
  return {
    shiftDate: minutes < morning ? addDays(today, -1) : today,
    shiftType: "NIGHT",
    schedule,
  };
}

/**
 * The operating date follows the active shift. Between midnight and the next
 * Morning boundary, activity still belongs to the previous hotel's business
 * date rather than the new calendar date.
 */
export function getOperationalBusinessDate(
  settings: unknown,
  now = new Date(),
): string {
  return getCurrentShiftContext(settings, now).shiftDate;
}

/** The hotel business day closes when its following Morning shift begins. */
export function getBusinessDayEnd(
  businessDate: string,
  settings: unknown,
): Date {
  return getShiftWindow(businessDate, "NIGHT", readShiftSchedule(settings)).end;
}

export function hasBusinessDayEnded(
  businessDate: string,
  settings: unknown,
  now = new Date(),
): boolean {
  return now >= getBusinessDayEnd(businessDate, settings);
}

/**
 * The instant window covering one whole hotel business day.
 *
 * A hotel day is not a calendar day: it opens when the Morning shift starts
 * and closes when the next Morning shift starts, so it spans midnight. Both
 * boundaries come from the hotel's own saved schedule, which every property
 * configures differently — a resort opening at 08:00 and a city hotel opening
 * at 06:00 must not share a hardcoded boundary.
 *
 * Use this for TIMESTAMP columns (createdAt, charge_date, actual check-in).
 * Calendar-date columns (@db.Date) should be matched with dateOnlyUTC instead.
 */
export function getBusinessDayWindow(
  businessDate: string,
  settings: unknown,
): { start: Date; end: Date } {
  const schedule = readShiftSchedule(settings);
  return {
    start: getShiftWindow(businessDate, "MORNING", schedule).start,
    end:   getShiftWindow(businessDate, "NIGHT",   schedule).end,
  };
}
