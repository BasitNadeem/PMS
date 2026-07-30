import { adminPrisma, FolioItemType, PaymentStatus, Prisma } from "@pms/db";
import type { TenantTx } from "@pms/db";
import { AppError } from "../utils/AppError";
import { getPKTDayRange, getCurrentPKTDate } from "../lib/timezone";
import { hasNightAuditWindowOpened } from "../lib/shiftSchedule";
import { notifyHotelDataChanged } from "../lib/realtime";
import { paginationMeta } from "../utils/pagination";

type WithTenantFn = <T>(fn: (db: TenantTx) => Promise<T>) => Promise<T>;

interface RunNightAuditOptions {
  skippedNoShowIds: string[];
  exceptionReason?: string;
}

async function buildPreflight(db: TenantTx, hotelId: string, businessDate: string) {
  const { start, end } = getPKTDayRange(businessDate);
  const businessDateObj = new Date(`${businessDate}T00:00:00.000Z`);

  const [
    noShowRaw,
    overdueRaw,
    checkedInRaw,
    existingRecord,
    openFolios,
    unsignedShiftReports,
    unresolvedDiscrepancies,
    unpostedPosOrders,
  ] = await Promise.all([
    db.reservation.findMany({
      where: { status: "CONFIRMED", checkInDate: { gte: start, lt: end } },
      include: {
        guest: { select: { fullName: true } },
        rooms: { take: 1, include: { room: { select: { number: true } } } },
      },
    }),
    db.reservation.findMany({
      where: { status: "CHECKED_IN", checkOutDate: { lt: start } },
      include: {
        guest: { select: { fullName: true } },
        rooms: { take: 1, include: { room: { select: { number: true } } } },
      },
    }),
    db.reservation.findMany({
      where: { status: "CHECKED_IN", checkInDate: { lt: end } },
      select: {
        id: true,
        confirmationNumber: true,
        subtotalAmount: true,
        folio: {
          select: {
            id: true,
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
    db.folio.aggregate({
      _count: { id: true },
      _sum: { balanceDue: true },
      where: { hotelId, isOpen: true, balanceDue: { gt: 0 } },
    }),
    db.shiftReport.findMany({
      where: { hotelId, shiftDate: businessDateObj, signedOffAt: null },
      select: { id: true, shiftType: true, staffId: true },
      orderBy: { createdAt: "asc" },
    }),
    db.shiftReport.count({
      where: {
        hotelId,
        shiftDate: businessDateObj,
        signedOffAt: { not: null },
        discrepancyAlerted: true,
      },
    }),
    db.posOrder.count({
      where: {
        hotelId,
        createdAt: { gte: start, lt: end },
        isPostedToFolio: false,
        OR: [
          { tableNumber: null },
          { NOT: { tableNumber: { startsWith: "PAID:" } } },
        ],
      },
    }),
  ]);

  const roomChargeMismatches = checkedInRaw.flatMap((reservation) => {
    if (!reservation.folio) return [];
    const actual = reservation.folio.items.reduce((sum, item) => sum + item.amount, 0);
    const expected = reservation.subtotalAmount;
    if (actual === expected) return [];
    return [{
      reservationId: reservation.id,
      confirmationNumber: reservation.confirmationNumber,
      expected,
      actual,
      difference: actual - expected,
    }];
  });

  const now = new Date();
  return {
    noShowCandidates: noShowRaw.map((reservation) => ({
      reservationId: reservation.id,
      confirmationNumber: reservation.confirmationNumber,
      guestName: reservation.guest.fullName,
      roomNumber: reservation.rooms[0]?.room.number ?? "—",
      checkInDate: reservation.checkInDate.toISOString().slice(0, 10),
    })),
    overdueDepartures: overdueRaw.map((reservation) => ({
      reservationId: reservation.id,
      confirmationNumber: reservation.confirmationNumber,
      guestName: reservation.guest.fullName,
      roomNumber: reservation.rooms[0]?.room.number ?? "—",
      checkOutDate: reservation.checkOutDate.toISOString().slice(0, 10),
      daysOverdue: Math.max(
        1,
        Math.floor((now.getTime() - reservation.checkOutDate.getTime()) / 86_400_000),
      ),
    })),
    roomChargeMismatches,
    openBalances: {
      count: openFolios._count.id,
      total: openFolios._sum.balanceDue ?? 0,
    },
    unsignedShiftReports: unsignedShiftReports.map((report) => ({
      id: report.id,
      shiftType: report.shiftType,
    })),
    unresolvedDiscrepancies,
    unpostedPosOrders,
    alreadyAudited: !!existingRecord,
  };
}

function exceptionCount(preflight: Awaited<ReturnType<typeof buildPreflight>>, skippedCount: number): number {
  return skippedCount
    + preflight.overdueDepartures.length
    + preflight.roomChargeMismatches.length
    + preflight.unsignedShiftReports.length
    + preflight.unresolvedDiscrepancies
    + preflight.unpostedPosOrders;
}

export const NightAuditService = {
  async getBusinessDate(withTenant: WithTenantFn, hotelId: string): Promise<string> {
    const hotel = await withTenant((db) =>
      db.hotel.findUniqueOrThrow({
        where: { id: hotelId },
        select: { currentBusinessDate: true },
      }),
    );
    return hotel.currentBusinessDate?.toISOString().slice(0, 10) ?? getCurrentPKTDate();
  },

  async getPreflightCheck(withTenant: WithTenantFn, hotelId: string, businessDate: string) {
    return withTenant((db) => buildPreflight(db, hotelId, businessDate));
  },

  async convertToNoShow(
    withTenant: WithTenantFn,
    hotelId: string,
    reservationId: string,
    actorId: string,
  ) {
    await withTenant(async (db) => {
      const [reservation, hotel] = await Promise.all([
        db.reservation.findFirst({
          where: { id: reservationId, hotelId },
          select: { id: true, status: true, checkInDate: true },
        }),
        db.hotel.findUniqueOrThrow({
          where: { id: hotelId },
          select: { currentBusinessDate: true },
        }),
      ]);
      if (!reservation) throw new AppError(404, "Reservation not found");
      if (reservation.status !== "CONFIRMED") {
        throw new AppError(400, `Cannot mark as no-show: reservation status is ${reservation.status}`);
      }
      const auditDate = hotel.currentBusinessDate?.toISOString().slice(0, 10) ?? getCurrentPKTDate();
      const { start, end } = getPKTDayRange(auditDate);
      if (reservation.checkInDate < start || reservation.checkInDate >= end) {
        throw new AppError(400, "Only an arrival on the current audit date can be marked no-show here");
      }

      await db.reservation.update({ where: { id: reservationId }, data: { status: "NO_SHOW" } });
      await db.auditLog.create({
        data: {
          hotelId,
          userId: actorId,
          action: "RESERVATION_NO_SHOW",
          entity: "reservation",
          entityId: reservationId,
          before: { status: "CONFIRMED" },
          after: { status: "NO_SHOW" },
        },
      });
    });
    // No room status is overwritten here: a no-show must never turn an
    // out-of-order or blocked room into VACANT_CLEAN.
    notifyHotelDataChanged(hotelId, "NIGHT_AUDIT_NO_SHOW");
  },

  async runNightAudit(
    withTenant: WithTenantFn,
    hotelId: string,
    businessDate: string,
    actorId: string,
    options: RunNightAuditOptions,
  ) {
    const expectedDate = await this.getBusinessDate(withTenant, hotelId);
    if (businessDate !== expectedDate) {
      throw new AppError(409, `The next audit date is ${expectedDate}; ${businessDate} cannot be closed`);
    }

    const currentPKTDate = getCurrentPKTDate();
    if (businessDate > currentPKTDate) {
      throw new AppError(400, "A future audit date cannot be closed");
    }

    const hotel = await withTenant((db) =>
      db.hotel.findUniqueOrThrow({ where: { id: hotelId }, select: { settings: true } }),
    );
    if (businessDate === currentPKTDate && !hasNightAuditWindowOpened(businessDate, hotel.settings)) {
      throw new AppError(409, "Night Audit opens when the configured Night shift begins");
    }

    const { start, end } = getPKTDayRange(businessDate);
    const businessDateObj = new Date(`${businessDate}T00:00:00.000Z`);
    const [year, month, day] = businessDate.split("-").map(Number);
    const nextDate = new Date(Date.UTC(year, month - 1, day + 1));

    try {
      const result = await withTenant(async (db) => {
        // pg_advisory_xact_lock returns PostgreSQL void. $queryRaw cannot
        // deserialize it; $executeRaw acquires the lock without decoding the
        // result and keeps it scoped to this transaction.
        await db.$executeRaw`
          SELECT pg_advisory_xact_lock(hashtext(${`night-audit:${hotelId}:${businessDate}`}))
        `;
        const freshHotel = await db.hotel.findUniqueOrThrow({
          where: { id: hotelId },
          select: { currentBusinessDate: true },
        });
        const freshExpected = freshHotel.currentBusinessDate?.toISOString().slice(0, 10) ?? currentPKTDate;
        if (freshExpected !== businessDate) {
          throw new AppError(409, `The next audit date is ${freshExpected}`);
        }

        const preflight = await buildPreflight(db, hotelId, businessDate);
        if (preflight.alreadyAudited) {
          throw new AppError(409, `Night audit for ${businessDate} has already been run`);
        }

        const remainingCandidateIds = new Set(
          preflight.noShowCandidates.map((candidate) => candidate.reservationId),
        );
        const skippedIds = [...new Set(options.skippedNoShowIds)]
          .filter((id) => remainingCandidateIds.has(id));
        if (skippedIds.length !== remainingCandidateIds.size) {
          throw new AppError(409, "Every remaining arrival must be marked no-show or explicitly skipped");
        }
        const exceptions = exceptionCount(preflight, skippedIds.length);
        if (exceptions > 0 && !options.exceptionReason?.trim()) {
          throw new AppError(400, "Explain the unresolved exceptions before closing the audit");
        }

        const [
          totalRooms,
          occupiedRooms,
          noShowsFlagged,
          roomRevenue,
          posRevenue,
          payments,
          directPosPayments,
          outstanding,
          checkIns,
          checkOuts,
        ] = await Promise.all([
          db.room.count({ where: { hotelId, isActive: true } }),
          db.reservationRoom.findMany({
            where: {
              reservation: {
                hotelId,
                status: { notIn: ["CANCELLED", "NO_SHOW"] },
              },
              checkInDate: { lt: end },
              checkOutDate: { gt: start },
            },
            distinct: ["roomId"],
            select: { roomId: true },
          }),
          db.reservation.count({
            where: { hotelId, status: "NO_SHOW", checkInDate: { gte: start, lt: end } },
          }),
          db.folioItem.aggregate({
            _sum: { amount: true },
            where: {
              hotelId,
              chargeDate: { gte: start, lt: end },
              isVoided: false,
              type: FolioItemType.ROOM_CHARGE,
            },
          }),
          db.posOrder.aggregate({
            _sum: { total: true },
            _count: { id: true },
            where: { hotelId, createdAt: { gte: start, lt: end } },
          }),
          db.payment.aggregate({
            _sum: { amount: true },
            where: {
              hotelId,
              createdAt: { gte: start, lt: end },
              status: PaymentStatus.COMPLETED,
              isRefund: false,
            },
          }),
          db.posOrder.aggregate({
            _sum: { total: true },
            where: {
              hotelId,
              createdAt: { gte: start, lt: end },
              isPostedToFolio: false,
              tableNumber: { startsWith: "PAID:" },
            },
          }),
          db.folio.aggregate({
            _sum: { balanceDue: true },
            where: { hotelId, balanceDue: { gt: 0 } },
          }),
          db.reservation.count({
            where: { hotelId, actualCheckIn: { gte: start, lt: end } },
          }),
          db.reservation.count({
            where: { hotelId, actualCheckOut: { gte: start, lt: end } },
          }),
        ]);
        const occupancyRate = totalRooms > 0
          ? Math.round((occupiedRooms.length / totalRooms) * 1000) / 10
          : 0;
        let expenses = 0;
        try {
          const expenseRows = await db.$queryRaw<Array<{ total: bigint }>>`
            SELECT COALESCE(SUM(amount), 0)::bigint AS total
            FROM expenses
            WHERE hotel_id = ${hotelId}::uuid
              AND date = ${businessDate}::date
          `;
          expenses = Number(expenseRows[0]?.total ?? 0);
        } catch {
          // A brand-new installation may not have applied the raw accounting tables yet.
        }
        const roomRevenueTotal = roomRevenue._sum.amount ?? 0;
        const posRevenueTotal = posRevenue._sum.total ?? 0;
        const totalCollected = (payments._sum.amount ?? 0) + (directPosPayments._sum.total ?? 0);
        const totalOutstanding = outstanding._sum.balanceDue ?? 0;
        const snapshot = {
          date: businessDate,
          occupancy: {
            totalRooms,
            occupied: occupiedRooms.length,
            checkIns,
            checkOuts,
            occupancyRate,
          },
          revenue: {
            roomRevenue: roomRevenueTotal,
            posRevenue: posRevenueTotal,
            totalCollected,
            outstanding: totalOutstanding,
            expenses,
          },
          operations: {
            posOrders: posRevenue._count.id,
            noShowsFlagged,
            openBalances: preflight.openBalances,
          },
          auditPreflight: preflight,
          auditResolution: {
            skippedNoShowIds: skippedIds,
            exceptionReason: options.exceptionReason?.trim() ?? null,
            exceptionCount: exceptions,
          },
        };

        const record = await db.nightAuditRecord.create({
          data: {
            hotelId,
            businessDate: businessDateObj,
            runAt: new Date(),
            runBy: actorId,
            occupancyRate,
            roomRevenue: roomRevenueTotal,
            posRevenue: posRevenueTotal,
            totalCollected,
            totalOutstanding,
            noShowsFlagged,
            openBalanceCount: preflight.openBalances.count,
            snapshot: snapshot as unknown as Prisma.InputJsonValue,
          },
        });
        await db.hotel.update({
          where: { id: hotelId },
          data: { currentBusinessDate: nextDate },
        });
        await db.auditLog.create({
          data: {
            hotelId,
            userId: actorId,
            action: "NIGHT_AUDIT_RUN",
            entity: "night_audit",
            entityId: record.id,
            after: {
              businessDate,
              nextAuditDate: nextDate.toISOString().slice(0, 10),
              exceptionCount: exceptions,
              exceptionReason: options.exceptionReason?.trim() ?? null,
            },
          },
        });
        return {
          id: record.id,
          businessDate,
          nextBusinessDate: nextDate.toISOString().slice(0, 10),
        };
      });
      notifyHotelDataChanged(hotelId, "NIGHT_AUDIT_COMPLETED");
      return result;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new AppError(409, `Night audit for ${businessDate} has already been run`);
      }
      throw error;
    }
  },

  async listAuditRecords(
    withTenant: WithTenantFn,
    hotelId: string,
    params: { page: number; limit: number },
  ) {
    const skip = (params.page - 1) * params.limit;
    const [items, total] = await withTenant((db) =>
      Promise.all([
        db.nightAuditRecord.findMany({
          where: { hotelId },
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
        db.nightAuditRecord.count({ where: { hotelId } }),
      ]),
    );

    const runByIds = [...new Set(items.map((record) => record.runBy))];
    const users = runByIds.length > 0
      ? await adminPrisma.user.findMany({
          where: { id: { in: runByIds } },
          select: { id: true, name: true },
        })
      : [];
    const userNames = new Map(users.map((user) => [user.id, user.name]));

    return {
      data: items.map((record) => ({
        ...record,
        businessDate: record.businessDate.toISOString().slice(0, 10),
        runAt: record.runAt.toISOString(),
        runByName: userNames.get(record.runBy) ?? "—",
        occupancyRate: Number(record.occupancyRate),
      })),
      meta: paginationMeta(total, params.page, params.limit),
    };
  },

  async getAuditRecordDetail(withTenant: WithTenantFn, hotelId: string, recordId: string) {
    const record = await withTenant((db) =>
      db.nightAuditRecord.findFirst({ where: { id: recordId, hotelId } }),
    );
    if (!record) throw new AppError(404, "Night audit record not found");

    const user = await adminPrisma.user.findUnique({
      where: { id: record.runBy },
      select: { name: true },
    });
    return {
      ...record,
      businessDate: record.businessDate.toISOString().slice(0, 10),
      runAt: record.runAt.toISOString(),
      runByName: user?.name ?? "—",
      occupancyRate: Number(record.occupancyRate),
    };
  },
};
