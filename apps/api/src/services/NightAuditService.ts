import { adminPrisma, Prisma } from "@pms/db";
import type { TenantTx } from "@pms/db";
import { AppError } from "../utils/AppError";
import { ReportService } from "./ReportService";
import { getPKTDayRange, getCurrentPKTDate } from "../lib/timezone";
import { paginationMeta } from "../utils/pagination";

type WithTenantFn = <T>(fn: (db: TenantTx) => Promise<T>) => Promise<T>;

export const NightAuditService = {
  async getBusinessDate(withTenant: WithTenantFn): Promise<string> {
    const hotel = await withTenant((db) =>
      db.hotel.findFirst({ select: { currentBusinessDate: true } }),
    );
    if (hotel?.currentBusinessDate) {
      return hotel.currentBusinessDate.toISOString().slice(0, 10);
    }
    return getCurrentPKTDate();
  },

  async getPreflightCheck(withTenant: WithTenantFn, hotelId: string, businessDate: string) {
    const { start, end } = getPKTDayRange(businessDate);
    const businessDateObj = new Date(businessDate + "T00:00:00.000Z");

    return withTenant(async (db) => {
      const [noShowRaw, overdueRaw, checkedInRaw, existingRecord] = await Promise.all([
        // CONFIRMED reservations whose checkInDate falls on businessDate
        db.reservation.findMany({
          where: {
            status: "CONFIRMED",
            checkInDate: { gte: start, lt: end },
          },
          include: {
            guest: { select: { fullName: true } },
            rooms: { take: 1, include: { room: { select: { number: true } } } },
          },
        }),
        // CHECKED_IN reservations whose checkOutDate is before businessDate (still not checked out)
        db.reservation.findMany({
          where: {
            status: "CHECKED_IN",
            checkOutDate: { lt: businessDateObj },
          },
          include: {
            guest: { select: { fullName: true } },
            rooms: { take: 1, include: { room: { select: { number: true } } } },
          },
        }),
        // CHECKED_IN reservations for room charge verification
        db.reservation.findMany({
          where: {
            status: "CHECKED_IN",
            checkInDate: { lte: businessDateObj },
          },
          include: {
            rooms: { take: 1, select: { ratePerNight: true } },
            folio: {
              include: {
                items: {
                  where: { type: "ROOM_CHARGE", isVoided: false },
                  select: { amount: true },
                },
              },
            },
          },
        }),
        db.nightAuditRecord.findFirst({
          where: { hotelId, businessDate: businessDateObj },
          select: { id: true },
        }),
      ]);

      const noShowCandidates = noShowRaw.map((r) => ({
        reservationId: r.id,
        confirmationNumber: r.confirmationNumber,
        guestName: r.guest.fullName,
        roomNumber: r.rooms[0]?.room.number ?? "—",
        checkInDate: r.checkInDate.toISOString().slice(0, 10),
      }));

      const now = new Date();
      const overdueDepartures = overdueRaw.map((r) => ({
        reservationId: r.id,
        confirmationNumber: r.confirmationNumber,
        guestName: r.guest.fullName,
        roomNumber: r.rooms[0]?.room.number ?? "—",
        checkOutDate: r.checkOutDate.toISOString().slice(0, 10),
        daysOverdue: Math.max(0, Math.floor((now.getTime() - r.checkOutDate.getTime()) / 86_400_000)),
      }));

      const roomChargeMismatches: {
        reservationId: string;
        confirmationNumber: string;
        expected: number;
        actual: number;
        difference: number;
      }[] = [];

      for (const r of checkedInRaw) {
        const rr = r.rooms[0];
        if (!rr || !r.folio) continue;
        const nights = Math.ceil(
          (r.checkOutDate.getTime() - r.checkInDate.getTime()) / 86_400_000,
        );
        const expected = rr.ratePerNight * nights;
        const actual = r.folio.items.reduce((s, fi) => s + fi.amount, 0);
        if (actual !== expected) {
          roomChargeMismatches.push({
            reservationId: r.id,
            confirmationNumber: r.confirmationNumber,
            expected,
            actual,
            difference: actual - expected,
          });
        }
      }

      return {
        noShowCandidates,
        overdueDepartures,
        roomChargeMismatches,
        alreadyAudited: !!existingRecord,
      };
    });
  },

  async convertToNoShow(
    withTenant: WithTenantFn,
    hotelId: string,
    reservationId: string,
    actorId: string,
  ) {
    return withTenant(async (db) => {
      const reservation = await db.reservation.findUnique({
        where: { id: reservationId },
        include: { rooms: { select: { roomId: true } } },
      });
      if (!reservation) throw new AppError(404, "Reservation not found");
      if (reservation.status !== "CONFIRMED") {
        throw new AppError(400, `Cannot mark as no-show: reservation status is ${reservation.status}`);
      }

      await db.reservation.update({
        where: { id: reservationId },
        data: { status: "NO_SHOW" },
      });

      const roomIds = reservation.rooms.map((r) => r.roomId);
      if (roomIds.length > 0) {
        await db.room.updateMany({
          where: { id: { in: roomIds } },
          data: { status: "VACANT_CLEAN" },
        });
      }

      await db.auditLog.create({
        data: {
          hotelId,
          userId: actorId,
          action: "RESERVATION_NO_SHOW",
          entity: "reservation",
          entityId: reservationId,
          before: JSON.parse(JSON.stringify({ status: "CONFIRMED" })),
          after:  JSON.parse(JSON.stringify({ status: "NO_SHOW" })),
        },
      });
    });
  },

  async runNightAudit(
    withTenant: WithTenantFn,
    hotelId: string,
    businessDate: string,
    actorId: string,
  ) {
    const businessDateObj = new Date(businessDate + "T00:00:00.000Z");

    // Guard: check for existing record before writing
    const existing = await withTenant((db) =>
      db.nightAuditRecord.findFirst({
        where: { hotelId, businessDate: businessDateObj },
        select: { id: true },
      }),
    );
    if (existing) {
      throw new AppError(409, `Night audit for ${businessDate} has already been run`);
    }

    // Snapshot via existing daily report logic
    const snapshot = await ReportService.getDailyReport(withTenant, hotelId, businessDate);

    // Final preflight counts at time of close
    const preflight = await NightAuditService.getPreflightCheck(withTenant, hotelId, businessDate);

    const [y, m, d] = businessDate.split("-").map(Number);
    const nextDate = new Date(Date.UTC(y, m - 1, d + 1));

    return withTenant(async (db) => {
      const record = await db.nightAuditRecord.create({
        data: {
          hotelId,
          businessDate: businessDateObj,
          runAt:            new Date(),
          runBy:            actorId,
          occupancyRate:    snapshot.occupancy.occupancyRate,
          roomRevenue:      snapshot.revenue.roomRevenue,
          posRevenue:       snapshot.revenue.posRevenue,
          totalCollected:   snapshot.revenue.totalCollected,
          totalOutstanding: snapshot.revenue.outstanding,
          noShowsFlagged:   preflight.noShowCandidates.length,
          openBalanceCount: preflight.overdueDepartures.length,
          snapshot:         snapshot as unknown as Prisma.InputJsonValue,
        },
      });

      await db.hotel.updateMany({
        where: { id: hotelId },
        data:  { currentBusinessDate: nextDate },
      });

      await db.auditLog.create({
        data: {
          hotelId,
          userId:   actorId,
          action:   "NIGHT_AUDIT_RUN",
          entity:   "night_audit",
          entityId: record.id,
          after:    JSON.parse(JSON.stringify({
            businessDate,
            nextBusinessDate: nextDate.toISOString().slice(0, 10),
          })),
        },
      });

      return {
        id:              record.id,
        businessDate,
        nextBusinessDate: nextDate.toISOString().slice(0, 10),
      };
    });
  },

  async listAuditRecords(
    withTenant: WithTenantFn,
    params: { page: number; limit: number },
  ) {
    const skip = (params.page - 1) * params.limit;

    const [items, total] = await withTenant((db) =>
      Promise.all([
        db.nightAuditRecord.findMany({
          orderBy: { businessDate: "desc" },
          skip,
          take: params.limit,
          select: {
            id: true, businessDate: true, runAt: true, runBy: true,
            occupancyRate: true, roomRevenue: true, posRevenue: true,
            totalCollected: true, totalOutstanding: true,
            noShowsFlagged: true, openBalanceCount: true,
          },
        }),
        db.nightAuditRecord.count(),
      ]),
    );

    const runByIds = [...new Set(items.map((r) => r.runBy))];
    const userNames = new Map<string, string>();
    if (runByIds.length > 0) {
      const users = await adminPrisma.user.findMany({
        where: { id: { in: runByIds } },
        select: { id: true, name: true },
      });
      for (const u of users) userNames.set(u.id, u.name);
    }

    return {
      data: items.map((r) => ({
        id:              r.id,
        businessDate:    r.businessDate.toISOString().slice(0, 10),
        runAt:           r.runAt.toISOString(),
        runBy:           r.runBy,
        runByName:       userNames.get(r.runBy) ?? "—",
        occupancyRate:   Number(r.occupancyRate),
        roomRevenue:     r.roomRevenue,
        posRevenue:      r.posRevenue,
        totalCollected:  r.totalCollected,
        totalOutstanding: r.totalOutstanding,
        noShowsFlagged:  r.noShowsFlagged,
        openBalanceCount: r.openBalanceCount,
      })),
      meta: paginationMeta(total, params.page, params.limit),
    };
  },

  async getAuditRecordDetail(withTenant: WithTenantFn, recordId: string) {
    const record = await withTenant((db) =>
      db.nightAuditRecord.findUnique({ where: { id: recordId } }),
    );
    if (!record) throw new AppError(404, "Night audit record not found");

    const users = await adminPrisma.user.findMany({
      where: { id: record.runBy },
      select: { id: true, name: true },
    });
    const runByName = users[0]?.name ?? "—";

    return {
      id:              record.id,
      hotelId:         record.hotelId,
      businessDate:    record.businessDate.toISOString().slice(0, 10),
      runAt:           record.runAt.toISOString(),
      runBy:           record.runBy,
      runByName,
      occupancyRate:   Number(record.occupancyRate),
      roomRevenue:     record.roomRevenue,
      posRevenue:      record.posRevenue,
      totalCollected:  record.totalCollected,
      totalOutstanding: record.totalOutstanding,
      noShowsFlagged:  record.noShowsFlagged,
      openBalanceCount: record.openBalanceCount,
      snapshot:        record.snapshot,
    };
  },
};
