import type { TenantTx } from "@pms/db";
import { getEffectiveLimits } from "../lib/subscription";
import {
  getNightAuditReminderTiming,
  getShiftReminderCandidates,
  readOperationalReminderSettings,
} from "../lib/operationalReminders";
import {
  getOperationalBusinessDate,
  type ShiftType,
} from "../lib/shiftSchedule";

type WithTenantFn = <T>(fn: (db: TenantTx) => Promise<T>) => Promise<T>;

export type OperationalReminder =
  | {
      id: string;
      kind: "SHIFT_HANDOVER";
      status: "DUE_SOON" | "OVERDUE";
      shiftDate: string;
      shiftType: ShiftType;
      endsAt: string;
      minutesFromEnd: number;
      url: string;
    }
  | {
      id: string;
      kind: "NIGHT_AUDIT";
      status: "DUE_SOON" | "OVERDUE";
      businessDate: string;
      openedAt: string;
      url: string;
    };

export const OperationalReminderService = {
  async getForDashboard(
    withTenant: WithTenantFn,
    hotelId: string,
    permissions: string[],
    now = new Date(),
  ): Promise<OperationalReminder[]> {
    const canSubmitHandover = permissions.includes("shiftHandover:submit");
    const canRunNightAudit = permissions.includes("nightAudit:run");
    if (!canSubmitHandover && !canRunNightAudit) return [];

    const hotel = await withTenant((db) =>
      db.hotel.findUniqueOrThrow({
        where: { id: hotelId },
        select: { settings: true, currentBusinessDate: true },
      }),
    );
    const reminderSettings = readOperationalReminderSettings(hotel.settings);
    let nightAuditEnabled = false;
    if (canRunNightAudit && reminderSettings.nightAuditEnabled) {
      const { features } = await getEffectiveLimits(hotelId);
      nightAuditEnabled = features.nightAudit;
    }

    const businessDate =
      hotel.currentBusinessDate?.toISOString().slice(0, 10)
      ?? getOperationalBusinessDate(hotel.settings, now);
    const shiftCandidates = canSubmitHandover
      ? getShiftReminderCandidates(hotel.settings, now, businessDate)
      : [];
    const nightAuditTiming = nightAuditEnabled
      ? getNightAuditReminderTiming(hotel.settings, businessDate, now)
      : null;

    const { completedShiftKeys, nightAuditComplete } = await withTenant(async (db) => {
      const reports = shiftCandidates.length === 0
        ? []
        : await db.shiftReport.findMany({
            where: {
              OR: shiftCandidates.map((item) => ({
                shiftDate: new Date(`${item.shiftDate}T00:00:00.000Z`),
                shiftType: item.shiftType,
              })),
            },
            select: { shiftDate: true, shiftType: true },
          });

      const audit = nightAuditTiming
        ? await db.nightAuditRecord.findFirst({
            where: {
              hotelId,
              businessDate: new Date(`${businessDate}T00:00:00.000Z`),
              reversedAt: null,
            },
            select: { id: true },
          })
        : null;

      return {
        completedShiftKeys: new Set(
          reports.map((report) =>
            `${report.shiftDate.toISOString().slice(0, 10)}:${report.shiftType}`
          ),
        ),
        nightAuditComplete: audit !== null,
      };
    });

    const reminders: OperationalReminder[] = shiftCandidates
      .filter((item) =>
        !completedShiftKeys.has(`${item.shiftDate}:${item.shiftType}`)
      )
      .map((item) => ({
        // Include the tenant in the client-side snooze key so switching hotels
        // in the same browser cannot hide another hotel's reminder.
        id: `${item.id}:${hotelId}`,
        kind: "SHIFT_HANDOVER" as const,
        status: item.status,
        shiftDate: item.shiftDate,
        shiftType: item.shiftType,
        endsAt: item.endsAt.toISOString(),
        minutesFromEnd: item.minutesFromEnd,
        url: "/operations/shift-handover",
      }));

    if (nightAuditTiming && !nightAuditComplete) {
      reminders.push({
        id: `night-audit:${businessDate}:${hotelId}`,
        kind: "NIGHT_AUDIT",
        status: nightAuditTiming.status,
        businessDate,
        openedAt: nightAuditTiming.closesAt.toISOString(),
        url: "/operations/night-audit",
      });
    }

    return reminders;
  },
};
