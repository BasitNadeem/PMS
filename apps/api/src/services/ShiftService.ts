import type { TenantTx } from "@pms/db";
import { adminPrisma, HousekeepingTaskStatus, MaintenanceStatus, PaymentStatus, Prisma, UserRole } from "@pms/db";
import { sendPushToUser } from "../lib/webpush";
import { notifyHotelDataChanged } from "../lib/realtime";
import { AppError } from "../utils/AppError";
import { paginationMeta } from "../utils/pagination";
import type { CreateShiftReportDto, SignOffDto, ListShiftsQuery } from "../schemas/shifts";
import { getPKTDayRange } from "../lib/timezone";
import { NotificationService } from "./NotificationService";
import {
  getCurrentShiftContext,
  getShiftWindow,
  readShiftSchedule,
  type ShiftType,
} from "../lib/shiftSchedule";

type WithTenantFn = <T>(fn: (db: TenantTx) => Promise<T>) => Promise<T>;

// Cash variance above this threshold (paisas) requires a written reason and triggers manager push
const DISCREPANCY_THRESHOLD_PAISAS = 50_000; // PKR 500

async function notifyManagersOfDiscrepancy(
  hotelId: string,
  payload: { title: string; body: string; url: string },
): Promise<void> {
  try {
    const managers = await adminPrisma.hotelUser.findMany({
      where:  { hotelId, role: { in: [UserRole.OWNER, UserRole.MANAGER] }, isActive: true },
      select: { userId: true },
    });
    await Promise.allSettled(managers.map((m) => sendPushToUser(m.userId, payload)));
  } catch { /* push delivery is non-critical */ }
}

function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + days));
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`;
}

function previousShift(date: string, shiftType: ShiftType): { date: string; type: ShiftType } {
  if (shiftType === "EVENING") return { date, type: "MORNING" };
  if (shiftType === "NIGHT") return { date, type: "EVENING" };
  return { date: addDays(date, -1), type: "NIGHT" };
}

export const ShiftService = {
  async getCurrentContext(withTenant: WithTenantFn, hotelId: string) {
    const hotel = await withTenant((db) =>
      db.hotel.findUniqueOrThrow({ where: { id: hotelId }, select: { settings: true } }),
    );
    return getCurrentShiftContext(hotel.settings);
  },

  async getPrefillData(
    withTenant: WithTenantFn,
    hotelId: string,
    date: string,
    shiftType: ShiftType,
  ) {
    const hotel = await withTenant((db) =>
      db.hotel.findUniqueOrThrow({ where: { id: hotelId }, select: { settings: true } }),
    );
    const { start: shiftStart, end: shiftEnd } = getShiftWindow(
      date,
      shiftType,
      readShiftSchedule(hotel.settings),
    );

    const data = await withTenant(async (db) => {
      const [checkIns, checkOuts, newBookings, posOrders, cashPayments, directPosCash] = await Promise.all([
        db.reservation.count({ where: { actualCheckIn:  { gte: shiftStart, lt: shiftEnd } } }),
        db.reservation.count({ where: { actualCheckOut: { gte: shiftStart, lt: shiftEnd } } }),
        db.reservation.count({ where: { createdAt:      { gte: shiftStart, lt: shiftEnd } } }),
        db.posOrder.count({    where: { createdAt:      { gte: shiftStart, lt: shiftEnd } } }),
        db.payment.aggregate({
          _sum: { amount: true },
          where: {
            createdAt: { gte: shiftStart, lt: shiftEnd },
            status:    PaymentStatus.COMPLETED,
            isRefund:  false,
            method:    "CASH",
          },
        }),
        db.posOrder.aggregate({
          _sum: { total: true },
          where: {
            createdAt: { gte: shiftStart, lt: shiftEnd },
            isPostedToFolio: false,
            tableNumber: "PAID:CASH",
          },
        }),
      ]);

      const previous = previousShift(date, shiftType);
      const lastReport = await db.shiftReport.findFirst({
        where: {
          shiftDate: new Date(`${previous.date}T00:00:00.000Z`),
          shiftType: previous.type,
          signedOffAt: { not: null },
        },
        orderBy: { signedOffAt: "desc" },
        select: { closingBalance: true },
      }) ?? await db.shiftReport.findFirst({
        where: { signedOffAt: { not: null } },
        orderBy: [{ shiftDate: "desc" }, { signedOffAt: "desc" }],
        select: { closingBalance: true },
      });

      return {
        checkIns,
        checkOuts,
        newBookings,
        posOrders,
        cashCollected: (cashPayments._sum.amount ?? 0) + (directPosCash._sum.total ?? 0),
        suggestedOpeningBalance: lastReport?.closingBalance ?? 0,
      };
    });

    let cashExpenses = 0;
    try {
      const rows = await adminPrisma.$queryRaw<Array<{ total: bigint }>>`
        SELECT COALESCE(SUM(amount), 0)::bigint AS total
        FROM expenses
        WHERE hotel_id = ${hotelId}::uuid
          AND payment_method = 'CASH'
          AND created_at >= ${shiftStart}
          AND created_at < ${shiftEnd}
      `;
      cashExpenses = Number(rows[0]?.total ?? 0);
    } catch {
      // Raw accounting tables are optional during a fresh setup.
    }

    return { ...data, cashExpenses, schedule: readShiftSchedule(hotel.settings) };
  },

  async getHandoverBriefing(
    withTenant: WithTenantFn,
    hotelId: string,
    shiftDate: string,
    shiftType: ShiftType,
  ) {
    const { start: dateObj, end: dateEnd } = getPKTDayRange(shiftDate);
    const [sy, sm, sd] = shiftDate.split("-").map(Number);
    const tDate = new Date(Date.UTC(sy, sm - 1, sd + 1));
    const tomorrowStr = `${tDate.getUTCFullYear()}-${String(tDate.getUTCMonth() + 1).padStart(2, "0")}-${String(tDate.getUTCDate()).padStart(2, "0")}`;
    const { start: tomorrowObj, end: tomorrowEnd } = getPKTDayRange(tomorrowStr);

    const [pendingHousekeeping, openMaintenance, tomorrowArrivals, tomorrowDepartures, unresolvedNotes] =
      await withTenant((db) =>
        Promise.all([
          db.housekeepingTask.findMany({
            where: {
              status: { in: [HousekeepingTaskStatus.PENDING, HousekeepingTaskStatus.IN_PROGRESS] },
              scheduledDate: { gte: dateObj, lte: dateEnd },
            },
            select: {
              id: true,
              taskType: true,
              status: true,
              startedAt: true,
              room: { select: { number: true } },
            },
            orderBy: { createdAt: "asc" },
          }),
          db.maintenanceTicket.findMany({
            where: {
              status: { in: [MaintenanceStatus.OPEN, MaintenanceStatus.IN_PROGRESS, MaintenanceStatus.AWAITING_PARTS] },
            },
            select: {
              id: true,
              title: true,
              priority: true,
              status: true,
              createdAt: true,
              room: { select: { number: true } },
            },
            orderBy: { createdAt: "desc" },
            take: 20,
          }),
          db.reservation.findMany({
            where: {
              checkInDate: { gte: tomorrowObj, lte: tomorrowEnd },
              status: "CONFIRMED",
            },
            select: {
              id: true,
              confirmationNumber: true,
              checkInDate: true,
              guest: { select: { fullName: true } },
              rooms: { take: 1, include: { roomType: { select: { name: true } } } },
            },
            orderBy: { checkInDate: "asc" },
          }),
          db.reservation.findMany({
            where: {
              checkOutDate: { gte: tomorrowObj, lte: tomorrowEnd },
              status: "CHECKED_IN",
            },
            select: {
              id: true,
              checkOutDate: true,
              guest: { select: { fullName: true } },
              rooms: { take: 1, include: { room: { select: { number: true } } } },
            },
            orderBy: { checkOutDate: "asc" },
          }),
          db.frontDeskNote.findMany({
            where: { isCompleted: false },
            select: {
              id: true,
              text: true,
              createdAt: true,
              createdBy: { select: { name: true } },
            },
            orderBy: { createdAt: "asc" },
          }),
        ])
      );

    return {
      shiftDate,
      shiftType,
      pendingHousekeeping: pendingHousekeeping.map((t) => ({
        id:         t.id,
        taskType:   t.taskType,
        status:     t.status,
        startedAt:  t.startedAt,
        roomNumber: t.room?.number ?? null,
      })),
      openMaintenance: openMaintenance.map((t) => ({
        id:         t.id,
        title:      t.title,
        priority:   t.priority,
        status:     t.status,
        createdAt:  t.createdAt,
        roomNumber: t.room?.number ?? null,
      })),
      tomorrowArrivals: tomorrowArrivals.map((r) => ({
        id:                 r.id,
        confirmationNumber: r.confirmationNumber,
        checkInDate:        r.checkInDate,
        guestName:          r.guest.fullName,
        roomTypeName:       r.rooms[0]?.roomType?.name ?? null,
      })),
      tomorrowDepartures: tomorrowDepartures.map((r) => ({
        id:          r.id,
        checkOutDate: r.checkOutDate,
        guestName:   r.guest.fullName,
        roomNumber:  r.rooms[0]?.room?.number ?? null,
      })),
      unresolvedNotes: unresolvedNotes.map((n) => ({
        id:            n.id,
        text:          n.text,
        createdAt:     n.createdAt,
        createdByName: n.createdBy.name,
      })),
    };
  },

  async createShiftReport(withTenant: WithTenantFn, hotelId: string, dto: CreateShiftReportDto, actorId: string) {
    const authoritative = await this.getPrefillData(withTenant, hotelId, dto.shiftDate, dto.shiftType);
    const closingBalance = dto.openingBalance + authoritative.cashCollected - authoritative.cashExpenses;
    const report = await withTenant(async (db) => {
      // pg_advisory_xact_lock returns PostgreSQL void. $queryRaw attempts to
      // deserialize that value and fails with P2010, rolling the handover back.
      // $executeRaw acquires the same transaction-scoped lock without decoding
      // the result row.
      await db.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext(${`${hotelId}:${dto.shiftDate}:${dto.shiftType}`}))
      `;
      const existing = await db.shiftReport.findFirst({
        where: {
          hotelId,
          shiftDate: new Date(`${dto.shiftDate}T00:00:00.000Z`),
          shiftType: dto.shiftType,
        },
        select: { id: true },
      });
      if (existing) {
        throw new AppError(409, "A handover for this hotel, date, and shift already exists");
      }

      const report = await db.shiftReport.create({
        data: {
          hotelId,
          staffId:          actorId,
          shiftDate:        new Date(dto.shiftDate),
          shiftType:        dto.shiftType,
          openingBalance:   dto.openingBalance,
          cashCollected:    authoritative.cashCollected,
          cashExpenses:     authoritative.cashExpenses,
          closingBalance,
          expectedBalance:  closingBalance,
          variance:         0,
          checkIns:         authoritative.checkIns,
          checkOuts:        authoritative.checkOuts,
          newBookings:      authoritative.newBookings,
          posOrders:        authoritative.posOrders,
          notes:            dto.notes ?? null,
          handoverBriefing: dto.handoverBriefing !== undefined
            ? (dto.handoverBriefing as Prisma.InputJsonValue)
            : Prisma.DbNull,
        },
      });

      await db.auditLog.create({
        data: {
          hotelId,
          userId:   actorId,
          action:   "SHIFT_REPORT_CREATE",
          entity:   "shiftReport",
          entityId: report.id,
        },
      });

      return report;
    });
    notifyHotelDataChanged(hotelId, "SHIFT_HANDOVER_CREATED");
    return report;
  },

  async signOff(withTenant: WithTenantFn, hotelId: string, reportId: string, dto: SignOffDto, actorId: string) {
    const outcome = await withTenant(async (db) => {
      const report = await db.shiftReport.findFirst({ where: { id: reportId, hotelId } });
      if (!report) throw new AppError(404, "Shift report not found");
      if (report.signedOffAt) throw new AppError(409, "Already signed off");
      const hotel = await db.hotel.findUniqueOrThrow({
        where: { id: hotelId },
        select: { settings: true },
      });
      const settings = (hotel.settings ?? {}) as Record<string, unknown>;
      if (settings.requireIndependentShiftSignoff === true && report.staffId === actorId) {
        throw new AppError(403, "A different authorized staff member must sign off this handover");
      }

      const variance = dto.actualCashCount - report.expectedBalance;
      const isLargeDiscrepancy = Math.abs(variance) > DISCREPANCY_THRESHOLD_PAISAS;

      if (isLargeDiscrepancy && !dto.varianceReason?.trim()) {
        throw new AppError(400, "A reason is required for variances over PKR 500");
      }

      const notes = dto.notes
        ? report.notes
          ? `${report.notes}\n\nSign-off note: ${dto.notes}`
          : dto.notes
        : report.notes;

      const updated = await db.shiftReport.update({
        where: { id: reportId },
        data: {
          signedOffAt:        new Date(),
          signedOffBy:        actorId,
          variance,
          notes,
          ...(dto.varianceReason ? { varianceReason: dto.varianceReason } : {}),
          ...(isLargeDiscrepancy ? { discrepancyAlerted: true } : {}),
        },
      });

      await db.auditLog.create({
        data: {
          hotelId,
          userId:   actorId,
          action:   "SHIFT_REPORT_SIGNED_OFF",
          entity:   "shiftReport",
          entityId: reportId,
          after:    { variance, actualCashCount: dto.actualCashCount, isLargeDiscrepancy },
        },
      });

      const discrepancyBody = isLargeDiscrepancy
        ? `PKR ${Math.round(Math.abs(variance) / 100).toLocaleString("en-PK")} variance on ${report.shiftDate.toISOString().slice(0, 10)} ${report.shiftType} shift`
        : null;

      return {
        report: { ...updated, actualCashCount: dto.actualCashCount },
        discrepancyBody,
      };
    });

    if (outcome.discrepancyBody) {
      try {
        await NotificationService.createNotificationsForRoles(
          hotelId,
          [UserRole.OWNER, UserRole.MANAGER],
          {
            title:      "Shift Cash Discrepancy",
            body:       outcome.discrepancyBody,
            type:       "SHIFT_CASH_DISCREPANCY",
            entityId:   reportId,
            entityType: "shift_report",
          },
        );
      } catch (err) {
        console.error("Failed to create shift discrepancy notification:", err);
      }

      void notifyManagersOfDiscrepancy(hotelId, {
        title: "⚠ Shift Cash Discrepancy",
        body:  outcome.discrepancyBody,
        url:   "/operations/shift-handover",
      });
    }

    notifyHotelDataChanged(hotelId);
    return outcome.report;
  },

  async list(withTenant: WithTenantFn, hotelId: string, params: ListShiftsQuery) {
    const skip = (params.page - 1) * params.limit;
    const where: Prisma.ShiftReportWhereInput = { hotelId };
    if (params.startDate || params.endDate) {
      where.shiftDate = {
        ...(params.startDate ? { gte: new Date(params.startDate) } : {}),
        ...(params.endDate   ? { lte: new Date(params.endDate)   } : {}),
      };
    }
    if (params.shiftType) where.shiftType = params.shiftType;

    const [reports, total] = await withTenant((db) =>
      Promise.all([
        db.shiftReport.findMany({
          where,
          skip,
          take: params.limit,
          orderBy: [{ shiftDate: "desc" }, { createdAt: "desc" }],
        }),
        db.shiftReport.count({ where }),
      ])
    );

    const staffIds = [
      ...new Set(
        reports.flatMap((r) => [r.staffId, r.signedOffBy].filter((id): id is string => !!id))
      ),
    ];
    const users = staffIds.length > 0
      ? await adminPrisma.user.findMany({ where: { id: { in: staffIds } }, select: { id: true, name: true } })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u.name]));

    return {
      data: reports.map((r) => ({
        ...r,
        actualCashCount: r.signedOffAt ? r.expectedBalance + r.variance : null,
        staffName:       userMap.get(r.staffId) ?? "Unknown",
        signedOffByName: r.signedOffBy ? userMap.get(r.signedOffBy) ?? "Unknown" : null,
      })),
      meta: paginationMeta(total, params.page, params.limit),
    };
  },

  async getOne(withTenant: WithTenantFn, hotelId: string, reportId: string) {
    const report = await withTenant((db) => db.shiftReport.findFirst({ where: { id: reportId, hotelId } }));
    if (!report) throw new AppError(404, "Shift report not found");

    const staffIds = [report.staffId, report.signedOffBy].filter((id): id is string => !!id);
    const users = await adminPrisma.user.findMany({ where: { id: { in: staffIds } }, select: { id: true, name: true } });
    const userMap = new Map(users.map((u) => [u.id, u.name]));

    return {
      ...report,
      actualCashCount: report.signedOffAt ? report.expectedBalance + report.variance : null,
      staffName:       userMap.get(report.staffId) ?? "Unknown",
      signedOffByName: report.signedOffBy ? userMap.get(report.signedOffBy) ?? "Unknown" : null,
    };
  },

  async acknowledgeDiscrepancy(withTenant: WithTenantFn, hotelId: string, reportId: string, actorId: string) {
    await withTenant(async (db) => {
      const report = await db.shiftReport.findFirst({ where: { id: reportId, hotelId } });
      if (!report) throw new AppError(404, "Shift report not found");
      await db.shiftReport.update({
        where: { id: reportId },
        data: { discrepancyAlerted: false },
      });
      await db.auditLog.create({
        data: {
          hotelId,
          userId: actorId,
          action: "SHIFT_DISCREPANCY_ACKNOWLEDGED",
          entity: "shiftReport",
          entityId: reportId,
        },
      });
    });
    notifyHotelDataChanged(hotelId, "SHIFT_DISCREPANCY_ACKNOWLEDGED");
  },

  async getDiscrepancyAlertCount(withTenant: WithTenantFn, hotelId: string) {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 3);
    const count = await withTenant((db) =>
      db.shiftReport.count({ where: { hotelId, discrepancyAlerted: true, shiftDate: { gte: since } } })
    );
    return count;
  },
};
