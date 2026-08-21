import { adminPrisma, Prisma } from "@pms/db";
import type { TenantTx } from "@pms/db";
import { AppError } from "../utils/AppError";
import { getPKTDayRange, getCurrentPKTDate } from "../lib/timezone";
import {
  getBusinessDayEnd,
  getOperationalBusinessDate,
  hasBusinessDayEnded,
} from "../lib/shiftSchedule";
import { notifyHotelDataChanged } from "../lib/realtime";
import { paginationMeta } from "../utils/pagination";
import { BusinessDaySnapshotService } from "./BusinessDaySnapshotService";

type WithTenantFn = <T>(fn: (db: TenantTx) => Promise<T>) => Promise<T>;

interface RunNightAuditOptions {
  skippedNoShowIds: string[];
  exceptionReason?: string;
}

interface AuditException {
  code: string;
  title: string;
  detail: string;
  route?: string;
}

function formatPKR(paisas: number): string {
  return `PKR ${Math.floor(Math.abs(paisas) / 100).toLocaleString("en-PK")}`;
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
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
      where: { hotelId, businessDate: businessDateObj, reversedAt: null },
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

function financialExceptionCount(snapshot: Awaited<ReturnType<typeof BusinessDaySnapshotService.build>>): number {
  const directDifference = snapshot.payments.postedDirectCollections === undefined
    ? 0
    : snapshot.payments.postedDirectCollections - snapshot.payments.directCollections;
  const collectionDifference = snapshot.payments.balanceBookDifference;
  const collectionExceptions = collectionDifference === 0
    ? Number(directDifference !== 0)
    : directDifference !== 0 && directDifference !== collectionDifference ? 2 : 1;
  return collectionExceptions + Number(snapshot.balanceBook.expenseDifference !== 0);
}

function buildControlExceptions(
  preflight: Awaited<ReturnType<typeof buildPreflight>>,
  snapshot: Awaited<ReturnType<typeof BusinessDaySnapshotService.build>>,
): { blockers: AuditException[]; warnings: AuditException[] } {
  const blockers: AuditException[] = preflight.noShowCandidates.map((candidate) => ({
    code: "ARRIVAL_NOT_ACTIONED",
    title: `${candidate.guestName} has not arrived`,
    detail: `${candidate.confirmationNumber} · Room ${candidate.roomNumber}`,
    route: `/reservations/${candidate.reservationId}`,
  }));
  const warnings: AuditException[] = [];
  for (const departure of preflight.overdueDepartures) {
    warnings.push({
      code: "OVERDUE_DEPARTURE",
      title: `${departure.guestName} remains checked in`,
      detail: `${departure.confirmationNumber} · ${departure.daysOverdue} day(s) overdue`,
      route: `/reservations/${departure.reservationId}`,
    });
  }
  for (const mismatch of preflight.roomChargeMismatches) {
    warnings.push({
      code: "ROOM_CHARGE_MISMATCH",
      title: `Room charge differs for ${mismatch.confirmationNumber}`,
      detail: `Expected ${mismatch.expected}; recorded ${mismatch.actual}`,
      route: `/reservations/${mismatch.reservationId}`,
    });
  }
  if (preflight.openBalances.count > 0) warnings.push({
    code: "OPEN_FOLIO_BALANCES",
    title: `${preflight.openBalances.count} folio balance(s) remain open`,
    detail: `Outstanding amount: ${preflight.openBalances.total}`,
    route: "/reports/outstanding-balances",
  });
  if (preflight.unsignedShiftReports.length > 0) warnings.push({
    code: "UNSIGNED_SHIFT_HANDOVERS",
    title: `${preflight.unsignedShiftReports.length} shift handover(s) are unsigned`,
    detail: preflight.unsignedShiftReports.map((report) => report.shiftType).join(", "),
    route: "/operations/shift-handover",
  });
  if (preflight.unresolvedDiscrepancies > 0) warnings.push({
    code: "SHIFT_CASH_DISCREPANCIES",
    title: `${preflight.unresolvedDiscrepancies} cash discrepancy alert(s) remain`,
    detail: "Review the signed shift handovers before closing.",
    route: "/operations/shift-handover",
  });
  if (preflight.unpostedPosOrders > 0) warnings.push({
    code: "UNPOSTED_POS_ORDERS",
    title: `${preflight.unpostedPosOrders} POS order(s) are not settled or posted`,
    detail: "These orders need a payment or folio destination.",
    route: "/pos",
  });
  const directCollectionDifference = snapshot.payments.postedDirectCollections === undefined
    ? 0
    : snapshot.payments.postedDirectCollections - snapshot.payments.directCollections;
  const collectionDifference = snapshot.payments.balanceBookDifference;
  const directDifferenceExplainsTotal = directCollectionDifference !== 0
    && directCollectionDifference === collectionDifference;
  if (collectionDifference !== 0 && !directDifferenceExplainsTotal) warnings.push({
    code: "COLLECTION_LEDGER_DIFFERENCE",
    title: "Collections do not reconcile with the Balance Book",
    detail: `${formatPKR(collectionDifference)} difference`,
    route: "/financials/cashbook",
  });
  if (directCollectionDifference !== 0) warnings.push({
    code: "DIRECT_COLLECTION_POSTING_DIFFERENCE",
    title: "Direct payments are not fully posted to the Balance Book",
    detail: `Expected ${formatPKR(snapshot.payments.directCollections)}; posted ${formatPKR(snapshot.payments.postedDirectCollections)}`,
    route: "/financials/cashbook",
  });
  if (snapshot.balanceBook.expenseDifference !== 0) warnings.push({
    code: "EXPENSE_LEDGER_DIFFERENCE",
    title: "Expenses do not reconcile with the Balance Book",
    detail: `${formatPKR(snapshot.balanceBook.expenseDifference)} difference`,
    route: "/financials/expenses",
  });
  if (snapshot.operationalCoverage.dirtyRooms > 0) warnings.push({
    code: "DIRTY_ROOMS",
    title: `${snapshot.operationalCoverage.dirtyRooms} room(s) remain dirty`,
    detail: "Housekeeping readiness is incomplete.",
    route: "/housekeeping",
  });
  if (snapshot.operationalCoverage.maintenance.length > 0) warnings.push({
    code: "OPEN_MAINTENANCE",
    title: `${snapshot.operationalCoverage.maintenance.length} maintenance ticket(s) remain open`,
    detail: "Open and in-progress maintenance is frozen into this audit.",
    route: "/maintenance",
  });
  if (snapshot.inventory.lowStock.length > 0) warnings.push({
    code: "LOW_STOCK",
    title: `${snapshot.inventory.lowStock.length} inventory item(s) are low`,
    detail: "Review replenishment before service is affected.",
    route: "/inventory",
  });
  return { blockers, warnings };
}

export const NightAuditService = {
  async getBusinessDateContext(
    withTenant: WithTenantFn,
    hotelId: string,
    now = new Date(),
  ): Promise<{ businessDate: string; closesAt: string; canClose: boolean }> {
    const hotel = await withTenant((db) =>
      db.hotel.findUniqueOrThrow({
        where: { id: hotelId },
        select: { currentBusinessDate: true, settings: true },
      }),
    );
    const businessDate = hotel.currentBusinessDate?.toISOString().slice(0, 10)
      ?? getOperationalBusinessDate(hotel.settings, now);
    const closesAt = getBusinessDayEnd(businessDate, hotel.settings);
    return {
      businessDate,
      closesAt: closesAt.toISOString(),
      canClose: now >= closesAt,
    };
  },

  async getBusinessDate(withTenant: WithTenantFn, hotelId: string): Promise<string> {
    return (await this.getBusinessDateContext(withTenant, hotelId)).businessDate;
  },

  async getPreflightCheck(withTenant: WithTenantFn, hotelId: string, businessDate: string) {
    return withTenant((db) => buildPreflight(db, hotelId, businessDate));
  },

  async getBusinessDaySnapshot(withTenant: WithTenantFn, hotelId: string, businessDate: string) {
    return withTenant(async (db) => {
      const hotel = await db.hotel.findUniqueOrThrow({
        where: { id: hotelId },
        select: { settings: true },
      });
      const [snapshot, preflight] = await Promise.all([
        BusinessDaySnapshotService.build(db, hotelId, businessDate, hotel.settings),
        buildPreflight(db, hotelId, businessDate),
      ]);
      const operationalExceptions = exceptionCount(preflight, preflight.noShowCandidates.length);
      const financialExceptions = financialExceptionCount(snapshot);
      const controls = buildControlExceptions(preflight, snapshot);
      return {
        ...snapshot,
        reconciliation: {
          ...snapshot.reconciliation,
          unpostedPosOrders: preflight.unpostedPosOrders,
          unresolvedExceptions: operationalExceptions + financialExceptions,
        },
        auditPreflight: preflight,
        controls,
      };
    });
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
    if (!hasBusinessDayEnded(businessDate, hotel.settings)) {
      throw new AppError(409, "Night Audit opens when the configured business day ends");
    }

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
          select: { currentBusinessDate: true, settings: true },
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
        const baseSnapshot = await BusinessDaySnapshotService.build(
          db,
          hotelId,
          businessDate,
          freshHotel.settings,
        );
        const operationalExceptions = exceptionCount(preflight, skippedIds.length);
        const financialExceptions = financialExceptionCount(baseSnapshot);
        const exceptions = operationalExceptions + financialExceptions;
        if (exceptions > 0 && !options.exceptionReason?.trim()) {
          throw new AppError(400, "Explain the unresolved exceptions before closing the audit");
        }
        const noShowsFlagged = baseSnapshot.reservations.noShows;
        const controls = buildControlExceptions(preflight, baseSnapshot);
        controls.blockers = controls.blockers.filter((blocker) => {
          const candidate = preflight.noShowCandidates.find((item) =>
            blocker.route === `/reservations/${item.reservationId}`,
          );
          return !candidate || !skippedIds.includes(candidate.reservationId);
        });
        if (controls.blockers.length > 0) {
          throw new AppError(409, "Resolve every blocking audit exception before closing the day");
        }
        if (skippedIds.length > 0) controls.warnings.unshift({
          code: "ARRIVALS_SKIPPED",
          title: `${skippedIds.length} pending arrival(s) were explicitly skipped`,
          detail: "Management accepted these arrivals as unresolved for this close.",
          route: "/reservations",
        });
        const snapshot = {
          ...baseSnapshot,
          operations: {
            posOrders: baseSnapshot.foodAndBeverage.pos.orders,
            noShowsFlagged,
            openBalances: preflight.openBalances,
          },
          reconciliation: {
            ...baseSnapshot.reconciliation,
            unpostedPosOrders: preflight.unpostedPosOrders,
            unresolvedExceptions: exceptions,
          },
          auditPreflight: preflight,
          auditResolution: {
            skippedNoShowIds: skippedIds,
            exceptionReason: options.exceptionReason?.trim() ?? null,
            exceptionCount: exceptions,
          },
          controls,
        };

        const latestRevision = await db.nightAuditRecord.aggregate({
          where: { hotelId, businessDate: businessDateObj },
          _max: { revision: true },
        });
        const revision = (latestRevision._max.revision ?? 0) + 1;

        const record = await db.nightAuditRecord.create({
          data: {
            hotelId,
            businessDate: businessDateObj,
            runAt: new Date(),
            runBy: actorId,
            occupancyRate: snapshot.occupancy.occupancyRate,
            roomRevenue: snapshot.revenue.roomRevenue,
            posRevenue: snapshot.revenue.posRevenue,
            totalCollected: snapshot.revenue.totalCollected,
            totalOutstanding: snapshot.revenue.outstanding,
            noShowsFlagged,
            openBalanceCount: preflight.openBalances.count,
            snapshot: snapshot as unknown as Prisma.InputJsonValue,
            revision,
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
              revision,
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
          orderBy: [{ businessDate: "desc" }, { revision: "desc" }],
          skip,
          take: params.limit,
          select: {
            id: true, businessDate: true, runAt: true, runBy: true,
            occupancyRate: true, roomRevenue: true, posRevenue: true,
            totalCollected: true, totalOutstanding: true,
            noShowsFlagged: true, openBalanceCount: true,
            revision: true, reversedAt: true, reversedBy: true, reversalReason: true,
          },
        }),
        db.nightAuditRecord.count({ where: { hotelId } }),
      ]),
    );

    const runByIds = [...new Set(items.flatMap((record) => [record.runBy, record.reversedBy].filter((id): id is string => !!id)))];
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
        reversedAt: record.reversedAt?.toISOString() ?? null,
        reversedByName: record.reversedBy ? userNames.get(record.reversedBy) ?? "—" : null,
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

    const users = await adminPrisma.user.findMany({
      where: { id: { in: [record.runBy, record.reversedBy].filter((id): id is string => !!id) } },
      select: { id: true, name: true },
    });
    const userNames = new Map(users.map((user) => [user.id, user.name]));
    return {
      ...record,
      businessDate: record.businessDate.toISOString().slice(0, 10),
      runAt: record.runAt.toISOString(),
      runByName: userNames.get(record.runBy) ?? "—",
      reversedByName: record.reversedBy ? userNames.get(record.reversedBy) ?? "—" : null,
      reversedAt: record.reversedAt?.toISOString() ?? null,
      occupancyRate: Number(record.occupancyRate),
    };
  },

  async reverseAudit(
    withTenant: WithTenantFn,
    hotelId: string,
    recordId: string,
    actorId: string,
    reason: string,
  ) {
    const result = await withTenant(async (db) => {
      const record = await db.nightAuditRecord.findFirst({
        where: { id: recordId, hotelId },
      });
      if (!record) throw new AppError(404, "Night audit record not found");
      if (record.reversedAt) throw new AppError(409, "This Night Audit has already been reversed");

      const businessDate = record.businessDate.toISOString().slice(0, 10);
      await db.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext(${`night-audit:${hotelId}:${businessDate}`}))
      `;
      const hotel = await db.hotel.findUniqueOrThrow({
        where: { id: hotelId },
        select: { currentBusinessDate: true },
      });
      const currentBusinessDate = hotel.currentBusinessDate?.toISOString().slice(0, 10);
      const expectedCurrentDate = addDays(businessDate, 1);
      if (currentBusinessDate !== expectedCurrentDate) {
        throw new AppError(
          409,
          `Only the latest closed audit can be reversed. The current audit date is ${currentBusinessDate ?? "not set"}`,
        );
      }

      const reversedAt = new Date();
      await db.nightAuditRecord.update({
        where: { id: record.id },
        data: { reversedAt, reversedBy: actorId, reversalReason: reason },
      });
      await db.hotel.update({
        where: { id: hotelId },
        data: { currentBusinessDate: record.businessDate },
      });
      await db.auditLog.create({
        data: {
          hotelId,
          userId: actorId,
          action: "NIGHT_AUDIT_REVERSED",
          entity: "night_audit",
          entityId: record.id,
          before: { businessDate, revision: record.revision, reversedAt: null },
          after: { businessDate, revision: record.revision, reversedAt: reversedAt.toISOString(), reason },
        },
      });
      return { id: record.id, businessDate, revision: record.revision, reversedAt: reversedAt.toISOString() };
    });
    notifyHotelDataChanged(hotelId, "NIGHT_AUDIT_REVERSED");
    return result;
  },
};
