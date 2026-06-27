import type { TenantTx } from "@pms/db";
import { adminPrisma, PaymentStatus, Prisma } from "@pms/db";
import { AppError } from "../utils/AppError";
import { paginationMeta } from "../utils/pagination";
import type { CreateShiftReportDto, SignOffDto, ListShiftsQuery } from "../schemas/shifts";

type WithTenantFn = <T>(fn: (db: TenantTx) => Promise<T>) => Promise<T>;

export const ShiftService = {
  async getPrefillData(withTenant: WithTenantFn, date: string, shiftType: string) {
    // Shift windows (PKT, UTC+5): MORNING 6am-2pm, EVENING 2pm-10pm, NIGHT 10pm-6am
    const [y, m, d] = date.split("-").map(Number);
    let shiftStart: Date;
    let shiftEnd: Date;
    if (shiftType === "MORNING") {
      shiftStart = new Date(Date.UTC(y, m - 1, d, 1, 0, 0));  // 6am PKT
      shiftEnd   = new Date(Date.UTC(y, m - 1, d, 9, 0, 0));  // 2pm PKT
    } else if (shiftType === "EVENING") {
      shiftStart = new Date(Date.UTC(y, m - 1, d, 9, 0, 0));
      shiftEnd   = new Date(Date.UTC(y, m - 1, d, 17, 0, 0)); // 10pm PKT
    } else {
      shiftStart = new Date(Date.UTC(y, m - 1, d, 17, 0, 0));
      shiftEnd   = new Date(Date.UTC(y, m - 1, d + 1, 1, 0, 0));
    }

    return withTenant(async (db) => {
      const [checkIns, checkOuts, newBookings, posOrders, cashPayments] = await Promise.all([
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
      ]);

      return {
        checkIns,
        checkOuts,
        newBookings,
        posOrders,
        cashCollected: cashPayments._sum.amount ?? 0,
      };
    });
  },

  async createShiftReport(withTenant: WithTenantFn, hotelId: string, dto: CreateShiftReportDto, actorId: string) {
    const closingBalance = dto.openingBalance + dto.cashCollected - dto.cashExpenses;
    return withTenant(async (db) => {
      const report = await db.shiftReport.create({
        data: {
          hotelId,
          staffId:         actorId,
          shiftDate:       new Date(dto.shiftDate),
          shiftType:       dto.shiftType,
          openingBalance:  dto.openingBalance,
          cashCollected:   dto.cashCollected,
          cashExpenses:    dto.cashExpenses,
          closingBalance,
          expectedBalance: closingBalance,
          variance:        0,
          checkIns:        dto.checkIns,
          checkOuts:       dto.checkOuts,
          newBookings:     dto.newBookings,
          posOrders:       dto.posOrders,
          notes:           dto.notes ?? null,
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
  },

  async signOff(withTenant: WithTenantFn, hotelId: string, reportId: string, dto: SignOffDto, actorId: string) {
    return withTenant(async (db) => {
      const report = await db.shiftReport.findFirst({ where: { id: reportId, hotelId } });
      if (!report) throw new AppError(404, "Shift report not found");
      if (report.signedOffAt) throw new AppError(409, "Already signed off");

      const variance = dto.actualCashCount - report.expectedBalance;
      const notes = dto.notes
        ? report.notes
          ? `${report.notes}\n\nSign-off note: ${dto.notes}`
          : dto.notes
        : report.notes;

      const updated = await db.shiftReport.update({
        where: { id: reportId },
        data: {
          signedOffAt: new Date(),
          signedOffBy: actorId,
          variance,
          notes,
        },
      });

      await db.auditLog.create({
        data: {
          hotelId,
          userId:   actorId,
          action:   "SHIFT_REPORT_SIGNED_OFF",
          entity:   "shiftReport",
          entityId: reportId,
          after:    { variance, actualCashCount: dto.actualCashCount },
        },
      });

      return { ...updated, actualCashCount: dto.actualCashCount };
    });
  },

  async list(withTenant: WithTenantFn, hotelId: string, params: ListShiftsQuery) {
    const skip = (params.page - 1) * params.limit;
    const where: Prisma.ShiftReportWhereInput = { hotelId };
    if (params.startDate || params.endDate) {
      where.shiftDate = {
        ...(params.startDate ? { gte: new Date(params.startDate) } : {}),
        ...(params.endDate ? { lte: new Date(params.endDate) } : {}),
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
};
