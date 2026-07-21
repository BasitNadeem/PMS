import type { TenantTx } from "@pms/db";
import { adminPrisma, FolioItemType, PaymentStatus, HousekeepingTaskStatus, MaintenanceStatus } from "@pms/db";
import { ExpenseService } from "./ExpenseService";
import { getPKTDayRange, getPKTRangeFromStrings, getPKTMonthRange } from "../lib/timezone";

type WithTenantFn = <T>(fn: (db: TenantTx) => Promise<T>) => Promise<T>;

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// ── shared helpers ────────────────────────────────────────────────────────────

function utcRange(startDate: string, endDate: string): { start: Date; end: Date } {
  return getPKTRangeFromStrings(startDate, endDate);
}

// ── report helpers ────────────────────────────────────────────────────────────

function utcDay(dateStr: string): { start: Date; end: Date } {
  return getPKTDayRange(dateStr);
}

function diffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function overlapDays(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): number {
  const start = aStart > bStart ? aStart : bStart;
  const end = aEnd < bEnd ? aEnd : bEnd;
  const diff = end.getTime() - start.getTime();
  return diff > 0 ? diff / 86_400_000 : 0;
}

type PaymentMethodKey = "cash" | "card" | "jazzcash" | "easypaisa" | "bankTransfer" | "other";

function mapMethodKey(method: string): PaymentMethodKey {
  switch (method) {
    case "CASH": return "cash";
    case "CREDIT_CARD":
    case "DEBIT_CARD": return "card";
    case "JAZZCASH": return "jazzcash";
    case "EASYPAISA": return "easypaisa";
    case "BANK_TRANSFER": return "bankTransfer";
    default: return "other";
  }
}

function emptyMethodBreakdown(): Record<PaymentMethodKey, number> {
  return { cash: 0, card: 0, jazzcash: 0, easypaisa: 0, bankTransfer: 0, other: 0 };
}

async function getCashVariance(hotelId: string, date: string, expectedCash: number) {
  try {
    const rows = await adminPrisma.$queryRaw<Array<{ entry_type: string; total: bigint }>>`
      SELECT le.entry_type, COALESCE(SUM(le.amount), 0)::bigint AS total
      FROM ledger_entries le
      JOIN cash_accounts ca ON ca.id = le.account_id
      WHERE le.hotel_id = ${hotelId}::uuid
        AND ca.account_type = 'CASH_DRAWER'
        AND le.entry_date = ${date}::date
      GROUP BY le.entry_type
    `;
    if (rows.length === 0) return null;
    let incoming = 0;
    let outgoing = 0;
    for (const r of rows) {
      if (r.entry_type === "INCOMING") incoming = Number(r.total);
      if (r.entry_type === "OUTGOING") outgoing = Number(r.total);
    }
    const ledgerBalance = incoming - outgoing;
    return { expectedCash, ledgerBalance, variance: ledgerBalance - expectedCash };
  } catch {
    return null;
  }
}

// ── DAILY REPORT ─────────────────────────────────────────────────────────────

export const ReportService = {
  async getDailyReport(withTenant: WithTenantFn, hotelId: string, date: string) {
    const { start: dayStart, end: dayEnd } = utcDay(date);

    const data = await withTenant(async (db) => {
      const [
        hotel,
        totalRooms,
        occupied,
        available,
        checkIns,
        checkOuts,
        roomRevenueAgg,
        totalChargedAgg,
        collectedAgg,
        outstandingAgg,
        paymentsByMethod,
        posAgg,
        posPostedCount,
        posTotalCount,
        posDirectOrdersList,
        hkTotal,
        hkCompleted,
        hkPending,
        hkCheckoutCleans,
        hkCheckoutCleansPending,
        maintOpen,
        maintUrgentOpen,
        maintResolvedToday,
        maintNewToday,
        groupReservations,
        arrivalReservations,
        departureReservations,
        stayOverReservations,
      ] = await Promise.all([
        db.hotel.findFirst({ select: { name: true, address: true, phone: true, city: true } }),
        db.room.count({ where: { isActive: true } }),
        db.room.count({ where: { status: "OCCUPIED" } }),
        db.room.count({ where: { status: "VACANT_CLEAN" } }),
        db.reservation.count({ where: { actualCheckIn: { gte: dayStart, lt: dayEnd } } }),
        db.reservation.count({ where: { status: "CHECKED_OUT", actualCheckOut: { gte: dayStart, lt: dayEnd } } }),

        db.folioItem.aggregate({
          _sum: { amount: true },
          where: { chargeDate: { gte: dayStart, lt: dayEnd }, isVoided: false, type: FolioItemType.ROOM_CHARGE },
        }),
        db.folioItem.aggregate({
          _sum: { amount: true },
          where: { chargeDate: { gte: dayStart, lt: dayEnd }, isVoided: false, type: { not: FolioItemType.DISCOUNT } },
        }),
        db.payment.aggregate({
          _sum: { amount: true },
          where: { createdAt: { gte: dayStart, lt: dayEnd }, status: PaymentStatus.COMPLETED, isRefund: false },
        }),
        db.folio.aggregate({
          _sum: { balanceDue: true },
          where: { balanceDue: { gt: 0 } },
        }),
        db.payment.groupBy({
          by: ["method"],
          _sum: { amount: true },
          where: { createdAt: { gte: dayStart, lt: dayEnd }, status: PaymentStatus.COMPLETED, isRefund: false },
        }),

        db.posOrder.aggregate({
          _sum: { total: true },
          _count: { id: true },
          where: { createdAt: { gte: dayStart, lt: dayEnd } },
        }),
        db.posOrder.count({ where: { createdAt: { gte: dayStart, lt: dayEnd }, isPostedToFolio: true } }),
        db.posOrder.count({ where: { createdAt: { gte: dayStart, lt: dayEnd } } }),
        // Direct POS cash sales (not posted to folio; payment method encoded in tableNumber as "PAID:CASH")
        // All direct POS orders (any payment method) — for totalCollected and byMethod breakdown
        db.posOrder.findMany({
          where: { createdAt: { gte: dayStart, lt: dayEnd }, isPostedToFolio: false, tableNumber: { startsWith: "PAID:" } },
          select: { total: true, tableNumber: true },
        }),

        db.housekeepingTask.count({ where: { scheduledDate: { gte: dayStart, lt: dayEnd } } }),
        db.housekeepingTask.count({ where: { scheduledDate: { gte: dayStart, lt: dayEnd }, status: HousekeepingTaskStatus.COMPLETED } }),
        db.housekeepingTask.count({ where: { scheduledDate: { gte: dayStart, lt: dayEnd }, status: HousekeepingTaskStatus.PENDING } }),
        db.housekeepingTask.count({ where: { scheduledDate: { gte: dayStart, lt: dayEnd }, taskType: "CHECKOUT_CLEAN" } }),
        db.housekeepingTask.count({ where: { scheduledDate: { gte: dayStart, lt: dayEnd }, taskType: "CHECKOUT_CLEAN", status: HousekeepingTaskStatus.PENDING } }),

        db.maintenanceTicket.count({ where: { status: { in: [MaintenanceStatus.OPEN, MaintenanceStatus.IN_PROGRESS, MaintenanceStatus.AWAITING_PARTS] } } }),
        db.maintenanceTicket.count({ where: { status: { in: [MaintenanceStatus.OPEN, MaintenanceStatus.IN_PROGRESS, MaintenanceStatus.AWAITING_PARTS] }, priority: "URGENT" } }),
        db.maintenanceTicket.count({ where: { status: { in: [MaintenanceStatus.RESOLVED, MaintenanceStatus.CLOSED] }, resolvedAt: { gte: dayStart, lt: dayEnd } } }),
        db.maintenanceTicket.count({ where: { createdAt: { gte: dayStart, lt: dayEnd } } }),

        db.reservation.findMany({
          where: {
            groupId: { not: null },
            OR: [
              { actualCheckIn: { gte: dayStart, lt: dayEnd } },
              { actualCheckOut: { gte: dayStart, lt: dayEnd } },
            ],
          },
          select: { groupId: true, actualCheckIn: true, actualCheckOut: true },
        }),

        db.reservation.findMany({
          where: { actualCheckIn: { gte: dayStart, lt: dayEnd }, status: { in: ["CHECKED_IN", "CONFIRMED", "CHECKED_OUT"] } },
          include: {
            guest: { select: { fullName: true } },
            rooms: { include: { room: { select: { number: true } } } },
          },
        }),

        db.reservation.findMany({
          where: { actualCheckOut: { gte: dayStart, lt: dayEnd }, status: "CHECKED_OUT" },
          include: {
            guest: { select: { fullName: true } },
            rooms: { include: { room: { select: { number: true } } } },
            folio: { select: { chargesTotal: true, paymentsTotal: true, balanceDue: true } },
          },
        }),

        db.reservation.findMany({
          where: { status: "CHECKED_IN", checkOutDate: { gte: dayEnd } },
          include: {
            guest: { select: { fullName: true } },
            rooms: { include: { room: { select: { number: true } } } },
          },
        }),
      ]);

      const roomRevenue = roomRevenueAgg._sum.amount ?? 0;
      const totalCharged = totalChargedAgg._sum.amount ?? 0;
      const otherCharges = totalCharged - roomRevenue;
      const outstanding = outstandingAgg._sum.balanceDue ?? 0;

      const byMethod = emptyMethodBreakdown();
      for (const p of paymentsByMethod) {
        byMethod[mapMethodKey(p.method)] += p._sum.amount ?? 0;
      }
      // Add direct POS sales (not posted to folio) to byMethod and totalCollected
      let posDirectTotal = 0;
      for (const o of posDirectOrdersList) {
        const method = o.tableNumber?.slice(5) ?? "CASH"; // strip "PAID:" prefix
        byMethod[mapMethodKey(method)] += o.total;
        posDirectTotal += o.total;
      }
      const totalCollected = (collectedAgg._sum.amount ?? 0) + posDirectTotal;

      const groupIds = new Set(groupReservations.map((r) => r.groupId).filter((id): id is string => !!id));
      const groupCheckIns = groupReservations.filter((r) => r.actualCheckIn && r.actualCheckIn >= dayStart && r.actualCheckIn < dayEnd).length;
      const groupCheckOuts = groupReservations.filter((r) => r.actualCheckOut && r.actualCheckOut >= dayStart && r.actualCheckOut < dayEnd).length;

      return {
        hotel: hotel ?? { name: "—", address: null, phone: null, city: null },
        occupancy: {
          totalRooms,
          occupied,
          available,
          checkIns,
          checkOuts,
          stayOvers: Math.max(occupied - checkIns, 0),
          occupancyRate: totalRooms > 0 ? Math.round((occupied / totalRooms) * 1000) / 10 : 0,
        },
        revenue: {
          roomRevenue,
          posRevenue: posAgg._sum.total ?? 0,
          otherCharges,
          totalCharged,
          totalCollected,
          outstanding,
          byMethod,
        },
        arrivals: arrivalReservations.map((r) => ({
          confirmationNumber: r.confirmationNumber,
          guestName: r.guest.fullName,
          roomNumber: r.rooms.map((rr) => rr.room.number).join(", "),
          nights: diffDays(r.checkInDate, r.checkOutDate),
          amount: r.totalAmount,
          status: r.status,
        })),
        departures: departureReservations.map((r) => ({
          confirmationNumber: r.confirmationNumber,
          guestName: r.guest.fullName,
          roomNumber: r.rooms.map((rr) => rr.room.number).join(", "),
          nights: diffDays(r.checkInDate, r.checkOutDate),
          totalCharged: r.folio?.chargesTotal ?? 0,
          totalPaid: r.folio?.paymentsTotal ?? 0,
          balance: r.folio?.balanceDue ?? 0,
        })),
        stayOvers: stayOverReservations.map((r) => ({
          confirmationNumber: r.confirmationNumber,
          guestName: r.guest.fullName,
          roomNumber: r.rooms.map((rr) => rr.room.number).join(", "),
          checkOutDate: r.checkOutDate.toISOString(),
          nightsRemaining: diffDays(dayStart, r.checkOutDate),
        })),
        operations: {
          housekeeping: {
            totalTasks: hkTotal,
            completed: hkCompleted,
            pending: hkPending,
            checkoutCleans: hkCheckoutCleans,
            checkoutCleansPending: hkCheckoutCleansPending,
          },
          maintenance: {
            openTickets: maintOpen,
            urgentOpen: maintUrgentOpen,
            resolvedToday: maintResolvedToday,
            newToday: maintNewToday,
          },
          groups: {
            activeGroups: groupIds.size,
            groupCheckIns,
            groupCheckOuts,
          },
          pos: {
            totalOrders: posTotalCount,
            totalRevenue: posAgg._sum.total ?? 0,
            postedToRoom: posPostedCount,
            directPayments: posTotalCount - posPostedCount,
          },
        },
        cashAmount: byMethod.cash,
      };
    });

    // Expenses — raw query outside withTenant (table not in Prisma schema)
    let expenses = { total: 0, byCategory: [] as { category: string; amount: number; count: number }[] };
    try {
      const summary = await ExpenseService.getSummary(hotelId, date, date);
      expenses = {
        total: summary.totalAmount,
        byCategory: summary.byCategory.map((r) => ({ category: r.category, amount: r.total, count: r.count })),
      };
    } catch { /* expenses table may not exist yet */ }

    const cashVariance = await getCashVariance(hotelId, date, data.cashAmount);

    const { cashAmount, ...rest } = data;
    void cashAmount;

    return {
      date,
      ...rest,
      expenses,
      cashVariance,
    };
  },

  // ── MONTHLY REPORT ───────────────────────────────────────────────────────

  async getMonthlyReport(withTenant: WithTenantFn, hotelId: string, year: number, month: number) {
    const { start: monthStart, end: monthEndExcl } = getPKTMonthRange(year, month);
    const daysInMonth = new Date(year, month, 0).getDate();

    const data = await withTenant(async (db) => {
      const [
        hotel,
        totalRooms,
        roomTypes,
        allPayments,
        roomChargeItems,
        totalChargedAgg,
        posRevenueAgg,
        totalReservations,
        monthReservations,
        occupancyReservations,
        occupancyReservationRooms,
        hkCompleted,
        maintCreated,
        maintResolved,
        groupReservations,
        posDirectMonthlyList,
      ] = await Promise.all([
        db.hotel.findFirst({ select: { name: true, address: true, phone: true, city: true } }),
        db.room.count({ where: { isActive: true } }),
        db.roomType.findMany({ where: { isActive: true }, select: { id: true, name: true } }),

        db.payment.findMany({
          where: { createdAt: { gte: monthStart, lt: monthEndExcl }, status: PaymentStatus.COMPLETED, isRefund: false },
          select: { amount: true, method: true, createdAt: true, reservationId: true },
        }),

        db.folioItem.findMany({
          where: { chargeDate: { gte: monthStart, lt: monthEndExcl }, isVoided: false, type: FolioItemType.ROOM_CHARGE },
          select: { amount: true, roomId: true },
        }),
        db.folioItem.aggregate({
          _sum: { amount: true },
          where: { chargeDate: { gte: monthStart, lt: monthEndExcl }, isVoided: false, type: { not: FolioItemType.DISCOUNT } },
        }),
        db.posOrder.aggregate({
          _sum: { total: true },
          where: { createdAt: { gte: monthStart, lt: monthEndExcl } },
        }),

        db.reservation.count({ where: { createdAt: { gte: monthStart, lt: monthEndExcl } } }),

        db.reservation.findMany({
          where: { createdAt: { gte: monthStart, lt: monthEndExcl } },
          select: { id: true, guestId: true, guest: { select: { fullName: true } } },
        }),

        db.reservation.findMany({
          where: {
            status: { in: ["CHECKED_IN", "CHECKED_OUT"] },
            checkInDate: { lt: monthEndExcl },
            checkOutDate: { gt: monthStart },
          },
          select: { checkInDate: true, checkOutDate: true },
        }),

        db.reservationRoom.findMany({
          where: {
            checkInDate: { lt: monthEndExcl },
            checkOutDate: { gt: monthStart },
            reservation: { status: { not: "CANCELLED" } },
          },
          select: { roomTypeId: true, checkInDate: true, checkOutDate: true },
        }),

        db.housekeepingTask.count({
          where: { status: HousekeepingTaskStatus.COMPLETED, completedAt: { gte: monthStart, lt: monthEndExcl } },
        }),

        db.maintenanceTicket.findMany({
          where: { createdAt: { gte: monthStart, lt: monthEndExcl } },
          select: { estimatedCost: true },
        }),
        db.maintenanceTicket.findMany({
          where: { resolvedAt: { gte: monthStart, lt: monthEndExcl }, status: { in: [MaintenanceStatus.RESOLVED, MaintenanceStatus.CLOSED] } },
          select: { createdAt: true, resolvedAt: true, actualCost: true },
        }),

        db.reservation.findMany({
          where: { groupId: { not: null }, checkInDate: { gte: monthStart, lt: monthEndExcl } },
          select: { groupId: true, totalAmount: true, rooms: { select: { id: true } } },
        }),

        // Direct POS sales (not posted to folio) — same gap as daily report
        db.posOrder.findMany({
          where: { createdAt: { gte: monthStart, lt: monthEndExcl }, isPostedToFolio: false, tableNumber: { startsWith: "PAID:" } },
          select: { total: true, tableNumber: true, createdAt: true },
        }),
      ]);

      // ── revenue by day ──────────────────────────────────────────────────
      const revenueByDay = Array.from({ length: daysInMonth }, (_, i) => {
        const day = i + 1;
        const dayStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const { start: dayStart, end: dayEnd } = getPKTDayRange(dayStr);
        const paymentsRevenue = allPayments
          .filter((p) => p.createdAt >= dayStart && p.createdAt < dayEnd)
          .reduce((s, p) => s + p.amount, 0);
        const posDirectRevenue = posDirectMonthlyList
          .filter((o) => o.createdAt >= dayStart && o.createdAt < dayEnd)
          .reduce((s, o) => s + o.total, 0);
        const revenue = paymentsRevenue + posDirectRevenue;
        const occupiedRooms = occupancyReservations.filter(
          (r) => r.checkInDate < dayEnd && r.checkOutDate > dayStart,
        ).length;
        const occupancy = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 1000) / 10 : 0;
        return {
          date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
          revenue,
          occupancy,
        };
      });

      // ── totals ────────────────────────────────────────────────────────
      const posDirectMonthlyTotal = posDirectMonthlyList.reduce((s, o) => s + o.total, 0);
      const totalRevenue = allPayments.reduce((s, p) => s + p.amount, 0) + posDirectMonthlyTotal;
      const roomRevenue = roomChargeItems.reduce((s, fi) => s + fi.amount, 0);
      const totalCharged = totalChargedAgg._sum.amount ?? 0;
      const otherCharges = totalCharged - roomRevenue;
      const posRevenue = posRevenueAgg._sum.total ?? 0;

      const uniqueGuests = new Set(monthReservations.map((r) => r.guestId)).size;
      const averageOccupancy = revenueByDay.reduce((s, d) => s + d.occupancy, 0) / daysInMonth;
      const totalOccupiedNights = occupancyReservationRooms.reduce(
        (s, rr) => s + overlapDays(rr.checkInDate, rr.checkOutDate, monthStart, monthEndExcl), 0,
      );
      const adr = totalOccupiedNights > 0 ? Math.round(roomRevenue / totalOccupiedNights) : 0;
      const revpar = totalRooms > 0 ? Math.round(roomRevenue / (totalRooms * daysInMonth)) : 0;
      const totalNightsBooked = occupancyReservations.reduce((s, r) => s + diffDays(r.checkInDate, r.checkOutDate), 0);
      const averageLengthOfStay = occupancyReservations.length > 0
        ? Math.round((totalNightsBooked / occupancyReservations.length) * 10) / 10
        : 0;

      // ── payment methods ──────────────────────────────────────────────────
      const paymentMethods = emptyMethodBreakdown();
      for (const p of allPayments) {
        paymentMethods[mapMethodKey(p.method)] += p.amount;
      }
      for (const o of posDirectMonthlyList) {
        const method = o.tableNumber?.slice(5) ?? "CASH";
        paymentMethods[mapMethodKey(method)] += o.total;
      }

      // ── top guests ────────────────────────────────────────────────────────
      const resIds = new Set(monthReservations.map((r) => r.id));
      const resById = new Map(monthReservations.map((r) => [r.id, r]));
      const guestStayCount = new Map<string, number>();
      for (const r of monthReservations) {
        guestStayCount.set(r.guestId, (guestStayCount.get(r.guestId) ?? 0) + 1);
      }
      const guestMap = new Map<string, { name: string; visits: number; totalSpend: number }>();
      for (const p of allPayments) {
        if (!p.reservationId || !resIds.has(p.reservationId)) continue;
        const r = resById.get(p.reservationId)!;
        const entry = guestMap.get(r.guestId) ?? { name: r.guest.fullName, visits: guestStayCount.get(r.guestId) ?? 1, totalSpend: 0 };
        entry.totalSpend += p.amount;
        guestMap.set(r.guestId, entry);
      }
      const topGuests = [...guestMap.values()].sort((a, b) => b.totalSpend - a.totalSpend).slice(0, 5);

      // ── group bookings ───────────────────────────────────────────────────
      const groupIds = new Set(groupReservations.map((r) => r.groupId).filter((id): id is string => !!id));
      const totalGroupRooms = groupReservations.reduce((s, r) => s + r.rooms.length, 0);
      const groupRevenue = groupReservations.reduce((s, r) => s + r.totalAmount, 0);

      // ── maintenance ───────────────────────────────────────────────────────
      const estimatedCost = maintCreated.reduce((s, t) => s + (t.estimatedCost ?? 0), 0);
      const actualCost = maintResolved.reduce((s, t) => s + (t.actualCost ?? 0), 0);
      const totalResolutionHours = maintResolved.reduce((s, t) => {
        if (!t.resolvedAt) return s;
        return s + (t.resolvedAt.getTime() - t.createdAt.getTime()) / 3_600_000;
      }, 0);
      const avgResolutionTime = maintResolved.length > 0
        ? Math.round((totalResolutionHours / maintResolved.length) * 10) / 10
        : 0;

      // ── occupancy by room type ───────────────────────────────────────────
      const occupiedNightsByType = new Map<string, number>();
      for (const rr of occupancyReservationRooms) {
        const nights = overlapDays(rr.checkInDate, rr.checkOutDate, monthStart, monthEndExcl);
        occupiedNightsByType.set(rr.roomTypeId, (occupiedNightsByType.get(rr.roomTypeId) ?? 0) + nights);
      }
      const revenueByRoomType = new Map<string, number>();
      const roomIdToType = new Map<string, string>();
      // FolioItem only has roomId — map via reservationRoom roomId->roomTypeId for rooms seen this month
      for (const rr of await db.reservationRoom.findMany({
        where: { checkInDate: { lt: monthEndExcl }, checkOutDate: { gt: monthStart } },
        select: { roomId: true, roomTypeId: true },
      })) {
        roomIdToType.set(rr.roomId, rr.roomTypeId);
      }
      for (const fi of roomChargeItems) {
        if (!fi.roomId) continue;
        const typeId = roomIdToType.get(fi.roomId);
        if (!typeId) continue;
        revenueByRoomType.set(typeId, (revenueByRoomType.get(typeId) ?? 0) + fi.amount);
      }
      const totalRoomsByType = new Map<string, number>();
      for (const room of await db.room.findMany({ where: { isActive: true }, select: { roomTypeId: true } })) {
        totalRoomsByType.set(room.roomTypeId, (totalRoomsByType.get(room.roomTypeId) ?? 0) + 1);
      }
      const occupancyByRoomType = roomTypes.map((rt) => {
        const roomsOfType = totalRoomsByType.get(rt.id) ?? 0;
        const occupiedNights = Math.round((occupiedNightsByType.get(rt.id) ?? 0) * 10) / 10;
        const possibleNights = roomsOfType * daysInMonth;
        return {
          roomType: rt.name,
          totalRooms: roomsOfType,
          occupiedNights,
          occupancyRate: possibleNights > 0 ? Math.round((occupiedNights / possibleNights) * 1000) / 10 : 0,
          revenue: revenueByRoomType.get(rt.id) ?? 0,
        };
      }).filter((rt) => rt.totalRooms > 0);

      return {
        hotel: hotel ?? { name: "—", address: null, phone: null, city: null },
        summary: {
          totalRevenue,
          totalReservations,
          totalGuests: uniqueGuests,
          averageOccupancy: Math.round(averageOccupancy * 10) / 10,
          adr,
          revpar,
          averageLengthOfStay,
        },
        revenueByDay,
        revenueBySource: { roomRevenue, posRevenue, otherCharges },
        paymentMethods,
        topGuests,
        groupBookings: {
          totalGroups: groupIds.size,
          totalGroupRooms,
          groupRevenue,
        },
        housekeeping: {
          totalTasksCompleted: hkCompleted,
          averageTasksPerDay: Math.round((hkCompleted / daysInMonth) * 10) / 10,
        },
        maintenance: {
          totalTickets: maintCreated.length,
          resolved: maintResolved.length,
          avgResolutionTime,
          estimatedCost,
          actualCost,
        },
        occupancyByRoomType,
      };
    });

    // Expenses — raw query outside withTenant (table not in Prisma schema)
    const startDateStr = `${year}-${String(month).padStart(2, "0")}-01`;
    const endDateStr = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
    let expensesByCategory: { category: string; amount: number; count: number }[] = [];
    let totalExpenses = 0;
    try {
      const summary = await ExpenseService.getSummary(hotelId, startDateStr, endDateStr);
      totalExpenses = summary.totalAmount;
      expensesByCategory = summary.byCategory.map((r) => ({ category: r.category, amount: r.total, count: r.count }));
    } catch { /* expenses table may not exist yet */ }

    const netProfit = data.summary.totalRevenue - totalExpenses;
    const profitMargin = data.summary.totalRevenue > 0
      ? Math.round((netProfit / data.summary.totalRevenue) * 1000) / 10
      : 0;

    return {
      year,
      month,
      monthName: MONTH_NAMES[month - 1],
      hotel: data.hotel,
      summary: {
        ...data.summary,
        totalExpenses,
        netProfit,
        profitMargin,
      },
      revenueByDay: data.revenueByDay,
      revenueBySource: data.revenueBySource,
      paymentMethods: data.paymentMethods,
      expensesByCategory,
      topGuests: data.topGuests,
      groupBookings: data.groupBookings,
      housekeeping: data.housekeeping,
      maintenance: data.maintenance,
      occupancyByRoomType: data.occupancyByRoomType,
    };
  },

  // ── REVENUE BY SOURCE ───────────────────────────────────────────────────────

  async getRevenueBySource(withTenant: WithTenantFn, startDate: string, endDate: string) {
    const { start, end } = utcRange(startDate, endDate);
    const [sy, sm, sd] = startDate.split("-").map(Number);

    return withTenant(async (db) => {
      const [folioItems, posOrders] = await Promise.all([
        db.folioItem.findMany({
          where: {
            chargeDate: { gte: start, lt: end },
            isVoided: false,
            type: { not: FolioItemType.DISCOUNT },
          },
          select: { type: true, amount: true, chargeDate: true },
        }),
        db.posOrder.findMany({
          where: { createdAt: { gte: start, lt: end } },
          select: { total: true, createdAt: true },
        }),
      ]);

      const dayMs = 86_400_000;
      const days = Math.round((end.getTime() - start.getTime()) / dayMs);
      const dailyBreakdown: Array<{
        date: string;
        roomRevenue: number;
        posRevenue: number;
        otherRevenue: number;
        total: number;
      }> = [];

      let totalRoom = 0;
      let totalPos = 0;
      let totalOther = 0;

      for (let i = 0; i < days; i++) {
        const dayStart = new Date(start.getTime() + i * dayMs);
        const dayEnd = new Date(start.getTime() + (i + 1) * dayMs);
        const dateStr = new Date(Date.UTC(sy, sm - 1, sd + i)).toISOString().slice(0, 10);

        const dayItems = folioItems.filter((fi) => fi.chargeDate >= dayStart && fi.chargeDate < dayEnd);
        const dayPos = posOrders.filter((po) => po.createdAt >= dayStart && po.createdAt < dayEnd);

        const roomRev = dayItems
          .filter((fi) => fi.type === FolioItemType.ROOM_CHARGE)
          .reduce((s, fi) => s + fi.amount, 0);
        const posRev = dayPos.reduce((s, po) => s + po.total, 0);
        const otherRev = dayItems
          .filter((fi) => fi.type !== FolioItemType.ROOM_CHARGE)
          .reduce((s, fi) => s + fi.amount, 0);

        totalRoom += roomRev;
        totalPos += posRev;
        totalOther += otherRev;

        dailyBreakdown.push({
          date: dateStr,
          roomRevenue: roomRev,
          posRevenue: posRev,
          otherRevenue: otherRev,
          total: roomRev + posRev + otherRev,
        });
      }

      const grandTotal = totalRoom + totalPos + totalOther;
      return {
        dailyBreakdown,
        totals: { roomRevenue: totalRoom, posRevenue: totalPos, otherRevenue: totalOther, total: grandTotal },
        percentageSplit: {
          room: grandTotal > 0 ? Math.round((totalRoom / grandTotal) * 1000) / 10 : 0,
          pos: grandTotal > 0 ? Math.round((totalPos / grandTotal) * 1000) / 10 : 0,
          other: grandTotal > 0 ? Math.round((totalOther / grandTotal) * 1000) / 10 : 0,
        },
      };
    });
  },

  // ── PAYMENT METHOD BREAKDOWN ────────────────────────────────────────────────

  async getPaymentMethodBreakdown(withTenant: WithTenantFn, startDate: string, endDate: string) {
    const { start, end } = utcRange(startDate, endDate);

    return withTenant(async (db) => {
      const grouped = await db.payment.groupBy({
        by: ["method"],
        _sum: { amount: true },
        _count: { id: true },
        where: {
          createdAt: { gte: start, lt: end },
          status: PaymentStatus.COMPLETED,
          isRefund: false,
        },
      });

      const total = grouped.reduce((s, g) => s + (g._sum.amount ?? 0), 0);
      const methodMap = new Map(grouped.map((g) => [g.method as string, g]));

      const ALL_METHODS = [
        "CASH", "JAZZCASH", "EASYPAISA", "BANK_TRANSFER",
        "CREDIT_CARD", "DEBIT_CARD", "CHEQUE",
        "ADVANCE_DEPOSIT", "OTA_COLLECT", "COMPLIMENTARY",
      ] as const;

      const methods = ALL_METHODS.map((m) => {
        const g = methodMap.get(m);
        const amount = g?._sum.amount ?? 0;
        const count = g?._count.id ?? 0;
        return {
          method: m,
          amount,
          count,
          percentage: total > 0 ? Math.round((amount / total) * 1000) / 10 : 0,
        };
      });

      return { methods, total };
    });
  },

  // ── OUTSTANDING BALANCES ────────────────────────────────────────────────────

  async getOutstandingBalances(withTenant: WithTenantFn) {
    return withTenant(async (db) => {
      const openFolios = await db.folio.findMany({
        where: { balanceDue: { gt: 0 } },
        select: {
          balanceDue: true,
          createdAt: true,
          reservation: {
            select: {
              confirmationNumber: true,
              status: true,
              checkOutDate: true,
              actualCheckOut: true,
              guest: { select: { fullName: true } },
              rooms: { select: { room: { select: { number: true } } } },
            },
          },
        },
      });

      const now = new Date();

      const entries = openFolios.map((f) => {
        const r = f.reservation;
        const refDate =
          r.status === "CHECKED_OUT"
            ? (r.actualCheckOut ?? r.checkOutDate)
            : f.createdAt;
        const daysOutstanding = Math.max(
          0,
          Math.floor((now.getTime() - refDate.getTime()) / 86_400_000),
        );
        return {
          confirmationNumber: r.confirmationNumber,
          guestName: r.guest.fullName,
          roomNumber: r.rooms.map((rr) => rr.room.number).join(", "),
          checkOutDate: r.checkOutDate.toISOString().slice(0, 10),
          balance: f.balanceDue,
          daysOutstanding,
        };
      }).sort((a, b) => b.daysOutstanding - a.daysOutstanding);

      const current = entries.filter((e) => e.daysOutstanding <= 7);
      const aging30 = entries.filter((e) => e.daysOutstanding > 7 && e.daysOutstanding <= 30);
      const aging30plus = entries.filter((e) => e.daysOutstanding > 30);

      const sumBalance = (arr: typeof entries) => arr.reduce((s, e) => s + e.balance, 0);

      return {
        buckets: { current, aging30, aging30plus },
        totals: {
          current: sumBalance(current),
          aging30: sumBalance(aging30),
          aging30plus: sumBalance(aging30plus),
        },
        grandTotal: sumBalance(entries),
      };
    });
  },

  // ── VOID & REFUND LOG ───────────────────────────────────────────────────────

  async getVoidRefundLog(withTenant: WithTenantFn, startDate: string, endDate: string) {
    const { start, end } = utcRange(startDate, endDate);

    return withTenant(async (db) => {
      const [voidedItems, refundPayments] = await Promise.all([
        db.folioItem.findMany({
          where: { isVoided: true, voidedAt: { gte: start, lt: end } },
          select: {
            description: true,
            amount: true,
            voidedAt: true,
            voidedBy: true,
            voidReason: true,
            folio: {
              select: {
                reservation: { select: { confirmationNumber: true } },
              },
            },
          },
        }),
        db.payment.findMany({
          where: { isRefund: true, createdAt: { gte: start, lt: end } },
          select: {
            amount: true,
            method: true,
            createdAt: true,
            postedBy: true,
            refundReason: true,
            notes: true,
            reservation: { select: { confirmationNumber: true } },
          },
        }),
      ]);

      // Collect user IDs for name lookup
      const userIds = new Set<string>();
      for (const v of voidedItems) if (v.voidedBy) userIds.add(v.voidedBy);
      for (const p of refundPayments) if (p.postedBy) userIds.add(p.postedBy);

      const userNames = new Map<string, string>();
      if (userIds.size > 0) {
        const hotelUsers = await db.hotelUser.findMany({
          where: { userId: { in: [...userIds] } },
          select: { userId: true, user: { select: { name: true } } },
        });
        for (const hu of hotelUsers) userNames.set(hu.userId, hu.user.name);
      }

      type LogEntry = {
        type: "VOID" | "REFUND";
        date: string;
        description: string;
        amount: number;
        performedBy: string;
        reservationConfirmation: string | null;
        notes: string | null;
      };

      const entries: LogEntry[] = [];

      for (const v of voidedItems) {
        entries.push({
          type: "VOID",
          date: (v.voidedAt ?? new Date()).toISOString(),
          description: v.description,
          amount: v.amount,
          performedBy: v.voidedBy ? (userNames.get(v.voidedBy) ?? "—") : "—",
          reservationConfirmation: v.folio?.reservation?.confirmationNumber ?? null,
          notes: v.voidReason ?? null,
        });
      }

      for (const p of refundPayments) {
        entries.push({
          type: "REFUND",
          date: p.createdAt.toISOString(),
          description: `${p.method} refund`,
          amount: p.amount,
          performedBy: p.postedBy ? (userNames.get(p.postedBy) ?? "—") : "—",
          reservationConfirmation: p.reservation?.confirmationNumber ?? null,
          notes: p.refundReason ?? p.notes ?? null,
        });
      }

      entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      return {
        entries,
        totalVoids: voidedItems.reduce((s, v) => s + v.amount, 0),
        totalRefunds: refundPayments.reduce((s, p) => s + p.amount, 0),
      };
    });
  },

  // ── CASH / BANK RECONCILIATION ──────────────────────────────────────────────

  async getCashReconciliation(hotelId: string, startDate: string, endDate: string) {
    try {
      const rows = await adminPrisma.$queryRaw<
        Array<{
          account_name: string;
          account_type: string;
          incoming: bigint;
          outgoing: bigint;
        }>
      >`
        SELECT
          ca.account_name,
          ca.account_type,
          COALESCE(SUM(CASE WHEN le.entry_type = 'INCOMING' THEN le.amount ELSE 0 END), 0)::bigint AS incoming,
          COALESCE(SUM(CASE WHEN le.entry_type = 'OUTGOING' THEN le.amount ELSE 0 END), 0)::bigint AS outgoing
        FROM cash_accounts ca
        LEFT JOIN ledger_entries le
          ON  le.account_id = ca.id
          AND le.hotel_id   = ${hotelId}::uuid
          AND le.entry_date >= ${startDate}::date
          AND le.entry_date <= ${endDate}::date
        WHERE ca.hotel_id = ${hotelId}::uuid
        GROUP BY ca.account_name, ca.account_type
        ORDER BY ca.account_name
      `;

      const accounts = rows.map((r) => ({
        name: r.account_name,
        type: r.account_type,
        incoming: Number(r.incoming),
        outgoing: Number(r.outgoing),
        netFlow: Number(r.incoming) - Number(r.outgoing),
      }));

      const totalIncoming = accounts.reduce((s, a) => s + a.incoming, 0);
      const totalOutgoing = accounts.reduce((s, a) => s + a.outgoing, 0);

      return {
        available: true as const,
        accounts,
        totals: { incoming: totalIncoming, outgoing: totalOutgoing, netFlow: totalIncoming - totalOutgoing },
      };
    } catch {
      return { available: false as const, error: "Balance Book data unavailable" };
    }
  },

  // ── OCCUPANCY TREND ─────────────────────────────────────────────────────────

  async getOccupancyTrend(withTenant: WithTenantFn, startDate: string, endDate: string) {
    const { start, end } = utcRange(startDate, endDate);
    const [sy, sm, sd] = startDate.split("-").map(Number);

    return withTenant(async (db) => {
      const [totalRooms, reservations] = await Promise.all([
        db.room.count({ where: { isActive: true } }),
        db.reservation.findMany({
          where: {
            status: { notIn: ["CANCELLED", "NO_SHOW"] },
            checkInDate: { lt: end },
            checkOutDate: { gt: start },
          },
          select: { checkInDate: true, checkOutDate: true },
        }),
      ]);

      const dayMs = 86_400_000;
      const days = Math.round((end.getTime() - start.getTime()) / dayMs);

      let peakDate = startDate;
      let peakRate = 0;
      let lowestDate = startDate;
      let lowestRate = 100;
      let totalOccupied = 0;

      const dailyBreakdown = Array.from({ length: days }, (_, i) => {
        const dayStart = new Date(start.getTime() + i * dayMs);
        const dayEnd = new Date(start.getTime() + (i + 1) * dayMs);
        const dateStr = new Date(Date.UTC(sy, sm - 1, sd + i)).toISOString().slice(0, 10);

        const occupied = reservations.filter(
          (r) => r.checkInDate < dayEnd && r.checkOutDate > dayStart,
        ).length;

        const occupancyRate =
          totalRooms > 0 ? Math.round((occupied / totalRooms) * 1000) / 10 : 0;

        totalOccupied += occupied;

        if (occupancyRate > peakRate) { peakRate = occupancyRate; peakDate = dateStr; }
        if (i === 0 || occupancyRate < lowestRate) { lowestRate = occupancyRate; lowestDate = dateStr; }

        return { date: dateStr, totalRooms, occupied, occupancyRate };
      });

      const avgOccupancy =
        days > 0
          ? Math.round(
              (dailyBreakdown.reduce((s, d) => s + d.occupancyRate, 0) / days) * 10,
            ) / 10
          : 0;

      return {
        dailyBreakdown,
        summary: { avgOccupancy, peakDate, peakRate, lowestDate, lowestRate, totalRoomNights: totalOccupied },
      };
    });
  },

  // ── ADR / RevPAR ────────────────────────────────────────────────────────────

  async getADRRevPAR(withTenant: WithTenantFn, startDate: string, endDate: string) {
    const { start, end } = utcRange(startDate, endDate);
    const [sy, sm, sd] = startDate.split("-").map(Number);

    return withTenant(async (db) => {
      const [totalRooms, folioItems, occupancyReservations] = await Promise.all([
        db.room.count({ where: { isActive: true } }),
        db.folioItem.findMany({
          where: {
            chargeDate: { gte: start, lt: end },
            isVoided: false,
            type: FolioItemType.ROOM_CHARGE,
          },
          select: { amount: true, chargeDate: true },
        }),
        db.reservation.findMany({
          where: {
            status: { in: ["CHECKED_IN", "CHECKED_OUT"] },
            checkInDate: { lt: end },
            checkOutDate: { gt: start },
          },
          select: { checkInDate: true, checkOutDate: true },
        }),
      ]);

      const dayMs = 86_400_000;
      const days = Math.round((end.getTime() - start.getTime()) / dayMs);
      let totalRoomRevenue = 0;
      let totalRoomsSold = 0;

      const dailyBreakdown = Array.from({ length: days }, (_, i) => {
        const dayStart = new Date(start.getTime() + i * dayMs);
        const dayEnd = new Date(start.getTime() + (i + 1) * dayMs);
        const dateStr = new Date(Date.UTC(sy, sm - 1, sd + i)).toISOString().slice(0, 10);

        const dayRevenue = folioItems
          .filter((fi) => fi.chargeDate >= dayStart && fi.chargeDate < dayEnd)
          .reduce((s, fi) => s + fi.amount, 0);

        const roomsSold = occupancyReservations.filter(
          (r) => r.checkInDate < dayEnd && r.checkOutDate > dayStart,
        ).length;

        const adr = roomsSold > 0 ? Math.round(dayRevenue / roomsSold) : 0;
        const revpar = totalRooms > 0 ? Math.round(dayRevenue / totalRooms) : 0;

        totalRoomRevenue += dayRevenue;
        totalRoomsSold += roomsSold;

        return { date: dateStr, adr, revpar, roomsSold, roomRevenue: dayRevenue };
      });

      const avgADR = totalRoomsSold > 0 ? Math.round(totalRoomRevenue / totalRoomsSold) : 0;
      const totalAvailableNights = totalRooms * days;
      const avgRevPAR =
        totalAvailableNights > 0 ? Math.round(totalRoomRevenue / totalAvailableNights) : 0;

      return {
        dailyBreakdown,
        summary: { avgADR, avgRevPAR, totalRoomRevenue, totalRoomsSold },
      };
    });
  },

  // ── ROOM TYPE PERFORMANCE ───────────────────────────────────────────────────

  async getRoomTypePerformance(withTenant: WithTenantFn, startDate: string, endDate: string) {
    const { start, end } = utcRange(startDate, endDate);
    const days = Math.round((end.getTime() - start.getTime()) / 86_400_000);

    return withTenant(async (db) => {
      const [roomTypes, occupancyRooms, roomChargeItems, allRooms] = await Promise.all([
        db.roomType.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
        db.reservationRoom.findMany({
          where: {
            checkInDate: { lt: end },
            checkOutDate: { gt: start },
            reservation: { status: { notIn: ["CANCELLED", "NO_SHOW"] } },
          },
          select: { roomTypeId: true, roomId: true, checkInDate: true, checkOutDate: true },
        }),
        db.folioItem.findMany({
          where: {
            chargeDate: { gte: start, lt: end },
            isVoided: false,
            type: FolioItemType.ROOM_CHARGE,
          },
          select: { amount: true, roomId: true },
        }),
        db.room.findMany({ where: { isActive: true }, select: { id: true, roomTypeId: true } }),
      ]);

      const roomToType = new Map(allRooms.map((r) => [r.id, r.roomTypeId]));
      const roomCountByType = new Map<string, number>();
      for (const r of allRooms) {
        roomCountByType.set(r.roomTypeId, (roomCountByType.get(r.roomTypeId) ?? 0) + 1);
      }

      const occupiedNightsByType = new Map<string, number>();
      for (const rr of occupancyRooms) {
        const nights = overlapDays(rr.checkInDate, rr.checkOutDate, start, end);
        occupiedNightsByType.set(rr.roomTypeId, (occupiedNightsByType.get(rr.roomTypeId) ?? 0) + nights);
      }

      const revenueByType = new Map<string, number>();
      for (const fi of roomChargeItems) {
        if (!fi.roomId) continue;
        const typeId = roomToType.get(fi.roomId);
        if (!typeId) continue;
        revenueByType.set(typeId, (revenueByType.get(typeId) ?? 0) + fi.amount);
      }

      return roomTypes
        .map((rt) => {
          const roomCount = roomCountByType.get(rt.id) ?? 0;
          const occupiedNights = Math.round((occupiedNightsByType.get(rt.id) ?? 0) * 10) / 10;
          const revenue = revenueByType.get(rt.id) ?? 0;
          const possibleNights = roomCount * days;
          const adr = occupiedNights > 0 ? Math.round(revenue / occupiedNights) : 0;
          const occupancyRate =
            possibleNights > 0
              ? Math.round((occupiedNights / possibleNights) * 1000) / 10
              : 0;
          return { roomTypeName: rt.name, totalRooms: roomCount, occupiedNights, occupancyRate, revenue, adr };
        })
        .filter((rt) => rt.totalRooms > 0)
        .sort((a, b) => b.revenue - a.revenue);
    });
  },

  // ── SOURCE OF BUSINESS ──────────────────────────────────────────────────────

  async getSourceOfBusiness(withTenant: WithTenantFn, startDate: string, endDate: string) {
    const { start, end } = utcRange(startDate, endDate);

    return withTenant(async (db) => {
      const reservations = await db.reservation.findMany({
        where: {
          checkInDate: { gte: start, lt: end },
          status: { notIn: ["CANCELLED", "NO_SHOW"] },
        },
        select: { source: true, totalAmount: true, checkInDate: true, checkOutDate: true },
      });

      const totalRevenue = reservations.reduce((s, r) => s + r.totalAmount, 0);

      const bySource = new Map<string, { count: number; roomNights: number; revenue: number }>();
      for (const r of reservations) {
        const key = r.source as string;
        const existing = bySource.get(key) ?? { count: 0, roomNights: 0, revenue: 0 };
        existing.count += 1;
        existing.roomNights += diffDays(r.checkInDate, r.checkOutDate);
        existing.revenue += r.totalAmount;
        bySource.set(key, existing);
      }

      return [...bySource.entries()]
        .map(([source, d]) => ({
          source,
          count: d.count,
          roomNights: d.roomNights,
          revenue: d.revenue,
          avgBookingValue: d.count > 0 ? Math.round(d.revenue / d.count) : 0,
          percentageOfTotal:
            totalRevenue > 0 ? Math.round((d.revenue / totalRevenue) * 1000) / 10 : 0,
        }))
        .sort((a, b) => b.revenue - a.revenue);
    });
  },

  // ── BOOKING ENGINE INSIGHTS ──────────────────────────────────────────────────
  // source = BOOKING_ENGINE is unforgeable by staff — it's never offered as an
  // option in the staff-facing reservation-source dropdown, only ever set by
  // the public booking routes. Revenue uses quotedRate × nights (same shape as
  // the guest-facing cart total) rather than totalAmount, since ENQUIRY-status
  // reservations never get totalAmount populated until confirmed/checked-in.

  async getBookingEngineInsights(withTenant: WithTenantFn, startDate?: string, endDate?: string) {
    const dateFilter = startDate && endDate ? utcRange(startDate, endDate) : null;

    return withTenant(async (db) => {
      const reservations = await db.reservation.findMany({
        where: {
          source: "BOOKING_ENGINE",
          ...(dateFilter ? { createdAt: { gte: dateFilter.start, lt: dateFilter.end } } : {}),
        },
        select: {
          id: true, confirmationNumber: true, status: true, groupId: true,
          checkInDate: true, checkOutDate: true, quotedRate: true, createdAt: true,
          guest: { select: { fullName: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      const byStatus: Record<string, number> = {};
      let multiRoomCount = 0;
      let totalEstimatedRevenue = 0;

      for (const r of reservations) {
        byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
        if (r.groupId) multiRoomCount += 1;
        totalEstimatedRevenue += r.quotedRate * Math.max(diffDays(r.checkInDate, r.checkOutDate), 0);
      }

      return {
        totalCount:            reservations.length,
        byStatus,
        multiRoomCount,
        singleRoomCount:       reservations.length - multiRoomCount,
        totalEstimatedRevenue,
        recent: reservations.slice(0, 10).map((r) => ({
          id:                 r.id,
          confirmationNumber: r.confirmationNumber,
          status:             r.status,
          guestName:          r.guest.fullName,
          checkInDate:        r.checkInDate,
          checkOutDate:       r.checkOutDate,
          isMultiRoom:        r.groupId !== null,
          createdAt:          r.createdAt,
        })),
      };
    });
  },

  // ── LENGTH OF STAY ──────────────────────────────────────────────────────────

  async getLengthOfStay(withTenant: WithTenantFn, startDate: string, endDate: string) {
    const { start, end } = utcRange(startDate, endDate);

    return withTenant(async (db) => {
      const reservations = await db.reservation.findMany({
        where: {
          checkInDate: { gte: start, lt: end },
          status: { in: ["CHECKED_IN", "CHECKED_OUT"] },
        },
        select: { checkInDate: true, checkOutDate: true, totalAmount: true },
      });

      const stays = reservations.map((r) => ({
        nights: diffDays(r.checkInDate, r.checkOutDate),
        revenue: r.totalAmount,
      }));

      const totalNights = stays.reduce((s, r) => s + r.nights, 0);
      const avgLengthOfStay =
        stays.length > 0 ? Math.round((totalNights / stays.length) * 10) / 10 : 0;

      const bucketDefs = [
        { label: "1 night", min: 1, max: 1 },
        { label: "2-3 nights", min: 2, max: 3 },
        { label: "4-7 nights", min: 4, max: 7 },
        { label: "8+ nights", min: 8, max: Infinity },
      ];

      const buckets = bucketDefs.map((b) => {
        const inBucket = stays.filter((s) => s.nights >= b.min && s.nights <= b.max);
        const revenue = inBucket.reduce((s, r) => s + r.revenue, 0);
        return {
          label: b.label,
          count: inBucket.length,
          percentage:
            stays.length > 0 ? Math.round((inBucket.length / stays.length) * 1000) / 10 : 0,
          avgRevenue: inBucket.length > 0 ? Math.round(revenue / inBucket.length) : 0,
        };
      });

      return {
        buckets,
        summary: { avgLengthOfStay, totalStays: stays.length },
      };
    });
  },

  // ── GUEST DIRECTORY ─────────────────────────────────────────────────────────

  async getGuestDirectory(
    withTenant: WithTenantFn,
    options: { search?: string; page: number; limit: number; sort: string },
  ) {
    const { search, page, limit, sort } = options;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: "insensitive" as const } },
              { phone: { contains: search } },
              { documentNumber: { contains: search } },
            ],
          }
        : {}),
    };

    const orderBy =
      sort === "totalStays"
        ? { totalStays: "desc" as const }
        : sort === "totalSpend"
          ? { totalSpend: "desc" as const }
          : sort === "createdAt"
            ? { createdAt: "desc" as const }
            : { fullName: "asc" as const };

    return withTenant(async (db) => {
      const [guests, total] = await Promise.all([
        db.guest.findMany({
          where,
          orderBy,
          skip,
          take: limit,
          select: {
            id: true,
            fullName: true,
            phone: true,
            email: true,
            documentNumber: true,
            nationality: true,
            totalStays: true,
            totalSpend: true,
            vipLevel: true,
            isBlacklisted: true,
            createdAt: true,
          },
        }),
        db.guest.count({ where }),
      ]);

      return { guests, total, page, limit };
    });
  },

  // ── REPEAT GUESTS ───────────────────────────────────────────────────────────

  async getRepeatGuests(withTenant: WithTenantFn, minStays: number) {
    return withTenant(async (db) => {
      const [guests, total] = await Promise.all([
        db.guest.findMany({
          where: { totalStays: { gte: minStays }, deletedAt: null },
          orderBy: { totalSpend: "desc" },
          take: 50,
          select: {
            id: true,
            fullName: true,
            totalStays: true,
            totalSpend: true,
            reservations: {
              select: { checkOutDate: true },
              orderBy: { checkOutDate: "desc" },
              take: 1,
            },
          },
        }),
        db.guest.count({ where: { totalStays: { gte: minStays }, deletedAt: null } }),
      ]);

      const result = guests.map((g) => ({
        id: g.id,
        fullName: g.fullName,
        totalStays: g.totalStays,
        totalSpend: g.totalSpend,
        avgSpendPerStay: g.totalStays > 0 ? Math.round(g.totalSpend / g.totalStays) : 0,
        lastStayDate:
          g.reservations[0]?.checkOutDate
            ? g.reservations[0].checkOutDate.toISOString().slice(0, 10)
            : null,
      }));

      const totalRevenue = result.reduce((s, g) => s + g.totalSpend, 0);

      return { guests: result, total, totalRevenue };
    });
  },

  // ── GUEST BLACKLIST REPORT ──────────────────────────────────────────────────

  async getGuestBlacklistReport(withTenant: WithTenantFn) {
    return withTenant(async (db) => {
      const entries = await db.guestBlacklist.findMany({
        orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
        include: {
          guest: { select: { fullName: true, phone: true } },
        },
      });

      const result = entries.map((e) => ({
        guestName: e.guest.fullName,
        phone: e.guest.phone ?? null,
        documentNumber: e.documentNumber ?? null,
        reason: e.reason,
        severity: e.severity,
        blacklistedAt: e.createdAt.toISOString().slice(0, 10),
      }));

      return {
        entries: result,
        total: result.length,
        bySeverity: {
          low: result.filter((e) => e.severity === 1).length,
          medium: result.filter((e) => e.severity === 2).length,
          high: result.filter((e) => e.severity >= 3).length,
        },
      };
    });
  },

  // ── GUEST DEMOGRAPHICS ──────────────────────────────────────────────────────

  async getGuestDemographics(withTenant: WithTenantFn, startDate: string, endDate: string) {
    const { start, end } = utcRange(startDate, endDate);

    return withTenant(async (db) => {
      const reservations = await db.reservation.findMany({
        where: {
          checkInDate: { gte: start, lt: end },
          status: { notIn: ["CANCELLED", "NO_SHOW"] },
        },
        select: {
          guestType: true,
          guest: { select: { nationality: true, isForeigner: true } },
        },
      });

      const total = reservations.length;

      const foreignCount = reservations.filter((r) => r.guest.isForeigner).length;
      const localCount = total - foreignCount;

      const natMap = new Map<string, number>();
      for (const r of reservations) {
        const nat = r.guest.nationality?.trim() || "Unknown";
        natMap.set(nat, (natMap.get(nat) ?? 0) + 1);
      }
      const sortedNat = [...natMap.entries()].sort((a, b) => b[1] - a[1]);
      const top10 = sortedNat.slice(0, 10);
      const otherCount = sortedNat.slice(10).reduce((s, [, c]) => s + c, 0);

      const byNationality = [
        ...top10.map(([nationality, count]) => ({
          nationality,
          count,
          percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
        })),
        ...(otherCount > 0
          ? [
              {
                nationality: "Other",
                count: otherCount,
                percentage: total > 0 ? Math.round((otherCount / total) * 1000) / 10 : 0,
              },
            ]
          : []),
      ];

      const typeMap = new Map<string, number>();
      for (const r of reservations) {
        const t = r.guestType as string;
        typeMap.set(t, (typeMap.get(t) ?? 0) + 1);
      }
      const byGuestType = [...typeMap.entries()]
        .map(([type, count]) => ({
          type,
          count,
          percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
        }))
        .sort((a, b) => b.count - a.count);

      return {
        total,
        localVsForeign: {
          localCount,
          foreignCount,
          local: total > 0 ? Math.round((localCount / total) * 1000) / 10 : 0,
          foreign: total > 0 ? Math.round((foreignCount / total) * 1000) / 10 : 0,
        },
        byNationality,
        byGuestType,
      };
    });
  },

  // ── Phase 3: Operations ───────────────────────────────────────────────────────

  async getHousekeepingPerformance(withTenant: WithTenantFn, startDate: string, endDate: string) {
    const { start, end } = utcRange(startDate, endDate);

    return withTenant(async (db) => {
      const tasks = await db.housekeepingTask.findMany({
        where: {
          completedAt: { gte: start, lt: end },
          status: HousekeepingTaskStatus.COMPLETED,
        },
        select: {
          taskType: true,
          startedAt: true,
          completedAt: true,
          createdAt: true,
          assignedToId: true,
          assignedTo: { select: { name: true } },
        },
      });

      const staffMap = new Map<string, {
        staffName: string;
        tasksCompleted: number;
        totalMinutes: number;
        timedCount: number;
        byType: Map<string, number>;
      }>();

      const globalTypeMap = new Map<string, number>();

      for (const t of tasks) {
        const sid = t.assignedToId ?? "__unassigned__";
        const sName = t.assignedTo?.name ?? "Unassigned";

        if (!staffMap.has(sid)) {
          staffMap.set(sid, { staffName: sName, tasksCompleted: 0, totalMinutes: 0, timedCount: 0, byType: new Map() });
        }
        const s = staffMap.get(sid)!;
        s.tasksCompleted += 1;

        const tStart = t.startedAt ?? t.createdAt;
        if (t.completedAt) {
          const mins = (t.completedAt.getTime() - tStart.getTime()) / 60000;
          if (mins > 0 && mins < 1440) {
            s.totalMinutes += mins;
            s.timedCount += 1;
          }
        }

        s.byType.set(t.taskType, (s.byType.get(t.taskType) ?? 0) + 1);
        globalTypeMap.set(t.taskType, (globalTypeMap.get(t.taskType) ?? 0) + 1);
      }

      const totalMinutesAll = [...staffMap.values()].reduce((s, v) => s + v.totalMinutes, 0);
      const timedCountAll = [...staffMap.values()].reduce((s, v) => s + v.timedCount, 0);

      const staffPerformance = [...staffMap.entries()]
        .map(([staffId, s]) => ({
          staffId: staffId === "__unassigned__" ? null : staffId,
          staffName: s.staffName,
          tasksCompleted: s.tasksCompleted,
          avgCompletionMinutes:
            s.timedCount > 0 ? Math.round((s.totalMinutes / s.timedCount) * 10) / 10 : null,
          byType: [...s.byType.entries()].map(([taskType, count]) => ({ taskType, count })),
        }))
        .sort((a, b) => b.tasksCompleted - a.tasksCompleted);

      const byType = [...globalTypeMap.entries()]
        .map(([taskType, count]) => ({ taskType, count }))
        .sort((a, b) => b.count - a.count);

      return {
        staffPerformance,
        byType,
        summary: {
          totalCompleted: tasks.length,
          avgCompletionMinutes:
            timedCountAll > 0 ? Math.round((totalMinutesAll / timedCountAll) * 10) / 10 : null,
          staffCount: staffMap.size,
        },
      };
    });
  },

  async getMaintenanceSummary(withTenant: WithTenantFn, startDate: string, endDate: string) {
    const { start, end } = utcRange(startDate, endDate);

    return withTenant(async (db) => {
      const tickets = await db.maintenanceTicket.findMany({
        where: { createdAt: { gte: start, lt: end } },
        select: {
          status: true,
          priority: true,
          category: true,
          estimatedCost: true,
          actualCost: true,
          createdAt: true,
          resolvedAt: true,
        },
      });

      const statusMap = new Map<string, number>();
      const priorityMap = new Map<string, number>();
      const categoryMap = new Map<string, number>();
      let totalEstimated = 0;
      let totalActual = 0;
      let totalResolutionHours = 0;
      let resolvedCount = 0;

      for (const t of tickets) {
        statusMap.set(t.status, (statusMap.get(t.status) ?? 0) + 1);
        priorityMap.set(t.priority, (priorityMap.get(t.priority) ?? 0) + 1);
        categoryMap.set(t.category, (categoryMap.get(t.category) ?? 0) + 1);

        if (t.estimatedCost) totalEstimated += t.estimatedCost;
        if (t.actualCost) totalActual += t.actualCost;

        if ((t.status === "RESOLVED" || t.status === "CLOSED") && t.resolvedAt) {
          const hours = (t.resolvedAt.getTime() - t.createdAt.getTime()) / 3_600_000;
          if (hours >= 0) {
            totalResolutionHours += hours;
            resolvedCount += 1;
          }
        }
      }

      const byStatus = [...statusMap.entries()]
        .map(([status, count]) => ({ status, count }))
        .sort((a, b) => b.count - a.count);
      const byPriority = [...priorityMap.entries()]
        .map(([priority, count]) => ({ priority, count }))
        .sort((a, b) => b.count - a.count);
      const byCategory = [...categoryMap.entries()]
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count);

      return {
        byStatus,
        byPriority,
        byCategory,
        costSummary: {
          totalEstimated,
          totalActual,
          costVariance: totalActual - totalEstimated,
        },
        summary: {
          total: tickets.length,
          avgResolutionHours:
            resolvedCount > 0 ? Math.round((totalResolutionHours / resolvedCount) * 10) / 10 : null,
          resolvedCount,
        },
      };
    });
  },

  async getStaffActivity(
    withTenant: WithTenantFn,
    startDate: string,
    endDate: string,
    userId?: string,
  ) {
    const { start, end } = utcRange(startDate, endDate);

    return withTenant(async (db) => {
      const logs = await db.auditLog.findMany({
        where: {
          createdAt: { gte: start, lt: end },
          ...(userId ? { userId } : {}),
        },
        select: {
          userId: true,
          action: true,
          entity: true,
          createdAt: true,
          user: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      function actionCategory(action: string): "create" | "update" | "delete" | "other" {
        if (action.endsWith("_CREATE")) return "create";
        if (
          action.endsWith("_UPDATE") ||
          action.endsWith("_CHECKIN") ||
          action.endsWith("_CHECKOUT") ||
          action.endsWith("_ASSIGN") ||
          action.endsWith("_RESOLVE") ||
          action.endsWith("_CLOSE") ||
          action.endsWith("_STATUS_UPDATE")
        )
          return "update";
        if (
          action.endsWith("_DELETE") ||
          action.endsWith("_CANCEL") ||
          action.endsWith("_VOID")
        )
          return "delete";
        return "other";
      }

      type StaffEntry = {
        staffName: string;
        totalActions: number;
        creates: number;
        updates: number;
        deletes: number;
        other: number;
        entityCounts: Map<string, number>;
        recentEntries: Array<{ action: string; entity: string; createdAt: Date }>;
      };

      const staffMap = new Map<string, StaffEntry>();

      for (const log of logs) {
        const sid = log.userId ?? "__system__";
        const sName = log.user?.name ?? "System";
        if (!staffMap.has(sid)) {
          staffMap.set(sid, {
            staffName: sName,
            totalActions: 0,
            creates: 0,
            updates: 0,
            deletes: 0,
            other: 0,
            entityCounts: new Map(),
            recentEntries: [],
          });
        }
        const s = staffMap.get(sid)!;
        s.totalActions += 1;
        const cat = actionCategory(log.action);
        if (cat === "create") s.creates += 1;
        else if (cat === "update") s.updates += 1;
        else if (cat === "delete") s.deletes += 1;
        else s.other += 1;

        s.entityCounts.set(log.entity, (s.entityCounts.get(log.entity) ?? 0) + 1);
        if (s.recentEntries.length < 10) {
          s.recentEntries.push({ action: log.action, entity: log.entity, createdAt: log.createdAt });
        }
      }

      const staff = [...staffMap.entries()]
        .map(([staffId, s]) => ({
          staffId: staffId === "__system__" ? null : staffId,
          staffName: s.staffName,
          totalActions: s.totalActions,
          creates: s.creates,
          updates: s.updates,
          deletes: s.deletes,
          other: s.other,
          topEntity:
            [...s.entityCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
          recentEntries: s.recentEntries,
        }))
        .sort((a, b) => b.totalActions - a.totalActions);

      return {
        staff,
        summary: {
          totalActions: logs.length,
          staffCount: staffMap.size,
          creates: staff.reduce((s, v) => s + v.creates, 0),
          updates: staff.reduce((s, v) => s + v.updates, 0),
          deletes: staff.reduce((s, v) => s + v.deletes, 0),
        },
      };
    });
  },

  async getGroupBookingsSummary(withTenant: WithTenantFn, startDate: string, endDate: string) {
    const { start, end } = utcRange(startDate, endDate);

    return withTenant(async (db) => {
      const groups = await db.groupBooking.findMany({
        where: {
          reservations: {
            some: {
              checkInDate: { gte: start, lt: end },
              status: { notIn: ["CANCELLED"] },
            },
          },
        },
        select: {
          id: true,
          name: true,
          payerName: true,
          reservations: {
            where: {
              checkInDate: { gte: start, lt: end },
              status: { notIn: ["CANCELLED"] },
            },
            select: {
              totalAmount: true,
              checkInDate: true,
              checkOutDate: true,
              rooms: { select: { id: true } },
            },
          },
        },
      });

      const rows = groups.map((g) => {
        const totalRevenue = g.reservations.reduce((s, r) => s + (r.totalAmount ?? 0), 0);
        const roomNights = g.reservations.reduce(
          (s, r) => s + diffDays(r.checkInDate, r.checkOutDate) * r.rooms.length,
          0,
        );
        return {
          groupId: g.id,
          groupName: g.name,
          operatorName: g.payerName ?? g.name,
          reservationCount: g.reservations.length,
          roomNights,
          totalRevenue,
          avgRevenuePerRoom: roomNights > 0 ? Math.round(totalRevenue / roomNights) : 0,
        };
      }).sort((a, b) => b.totalRevenue - a.totalRevenue);

      const totalRevenue = rows.reduce((s, r) => s + r.totalRevenue, 0);
      const totalRoomNights = rows.reduce((s, r) => s + r.roomNights, 0);

      return {
        groups: rows,
        summary: {
          totalGroups: rows.length,
          totalRoomNights,
          totalRevenue,
          avgRevenuePerGroup: rows.length > 0 ? Math.round(totalRevenue / rows.length) : 0,
        },
      };
    });
  },

  // ── Phase 3: Inventory ────────────────────────────────────────────────────────

  async getStockConsumption(
    withTenant: WithTenantFn,
    startDate: string,
    endDate: string,
    category?: string,
  ) {
    const { start, end } = utcRange(startDate, endDate);

    return withTenant(async (db) => {
      const txns = await db.inventoryTransaction.findMany({
        where: {
          type: "CONSUMPTION",
          createdAt: { gte: start, lt: end },
          ...(category ? { item: { category } } : {}),
        },
        select: {
          itemId: true,
          quantity: true,
          unitCost: true,
          totalCost: true,
          item: { select: { name: true, category: true, unit: true } },
        },
      });

      const itemMap = new Map<string, {
        itemName: string;
        category: string;
        unit: string;
        totalQuantity: number;
        totalCost: number;
      }>();

      for (const t of txns) {
        const existing = itemMap.get(t.itemId) ?? {
          itemName: t.item.name,
          category: t.item.category,
          unit: t.item.unit,
          totalQuantity: 0,
          totalCost: 0,
        };
        existing.totalQuantity += Number(t.quantity);
        existing.totalCost += t.totalCost ?? (t.unitCost ? Number(t.quantity) * t.unitCost : 0);
        itemMap.set(t.itemId, existing);
      }

      const catMap = new Map<string, number>();
      const items = [...itemMap.entries()].map(([itemId, v]) => {
        catMap.set(v.category, (catMap.get(v.category) ?? 0) + v.totalCost);
        return { itemId, ...v, totalQuantity: Math.round(Number(v.totalQuantity) * 1000) / 1000 };
      }).sort((a, b) => b.totalCost - a.totalCost);

      const byCategory = [...catMap.entries()]
        .map(([cat, cost]) => ({ category: cat, totalCost: cost }))
        .sort((a, b) => b.totalCost - a.totalCost);

      return {
        items,
        byCategory,
        summary: {
          totalTransactions: txns.length,
          uniqueItems: items.length,
          totalCost: items.reduce((s, v) => s + v.totalCost, 0),
        },
      };
    });
  },

  async getWasteLoss(withTenant: WithTenantFn, startDate: string, endDate: string) {
    const { start, end } = utcRange(startDate, endDate);

    return withTenant(async (db) => {
      const [wasteTxns, consumptionTxns] = await Promise.all([
        db.inventoryTransaction.findMany({
          where: { type: "WASTE", createdAt: { gte: start, lt: end } },
          select: {
            itemId: true,
            quantity: true,
            unitCost: true,
            totalCost: true,
            item: { select: { name: true, category: true, unit: true } },
          },
        }),
        db.inventoryTransaction.findMany({
          where: { type: "CONSUMPTION", createdAt: { gte: start, lt: end } },
          select: { itemId: true, quantity: true },
        }),
      ]);

      const consumptionByItem = new Map<string, number>();
      for (const t of consumptionTxns) {
        consumptionByItem.set(t.itemId, (consumptionByItem.get(t.itemId) ?? 0) + Number(t.quantity));
      }

      const wasteMap = new Map<string, {
        itemName: string;
        category: string;
        unit: string;
        wasteQuantity: number;
        costLost: number;
      }>();

      for (const t of wasteTxns) {
        const existing = wasteMap.get(t.itemId) ?? {
          itemName: t.item.name,
          category: t.item.category,
          unit: t.item.unit,
          wasteQuantity: 0,
          costLost: 0,
        };
        existing.wasteQuantity += Number(t.quantity);
        existing.costLost += t.totalCost ?? (t.unitCost ? Number(t.quantity) * t.unitCost : 0);
        wasteMap.set(t.itemId, existing);
      }

      const items = [...wasteMap.entries()].map(([itemId, v]) => {
        const consumptionQty = consumptionByItem.get(itemId) ?? 0;
        const total = v.wasteQuantity + consumptionQty;
        return {
          itemId,
          itemName: v.itemName,
          category: v.category,
          unit: v.unit,
          wasteQuantity: Math.round(v.wasteQuantity * 1000) / 1000,
          costLost: v.costLost,
          wastePercentage: total > 0 ? Math.round((v.wasteQuantity / total) * 1000) / 10 : 0,
        };
      }).sort((a, b) => b.costLost - a.costLost);

      const totalCostLost = items.reduce((s, v) => s + v.costLost, 0);

      return {
        items,
        summary: {
          totalWasteItems: items.length,
          totalCostLost,
          totalWasteQuantity: items.reduce((s, v) => s + v.wasteQuantity, 0),
        },
      };
    });
  },

  async getLowStockReorder(withTenant: WithTenantFn) {
    return withTenant(async (db) => {
      const allItems = await db.inventoryItem.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          category: true,
          unit: true,
          currentStock: true,
          parLevel: true,
          reorderLevel: true,
          costPerUnit: true,
          supplier: true,
        },
      });

      const lowStock = allItems
        .filter((item) => Number(item.currentStock) <= Number(item.reorderLevel))
        .map((item) => {
          const currentQty = Number(item.currentStock);
          const reorderQty = Number(item.reorderLevel);
          const parQty = Number(item.parLevel);
          const deficit = Math.max(0, parQty - currentQty);
          return {
            itemId: item.id,
            itemName: item.name,
            category: item.category,
            unit: item.unit,
            currentStock: Math.round(currentQty * 1000) / 1000,
            reorderLevel: Math.round(reorderQty * 1000) / 1000,
            parLevel: Math.round(parQty * 1000) / 1000,
            costPerUnit: item.costPerUnit,
            estimatedReorderCost: Math.round(deficit * item.costPerUnit),
            supplier: item.supplier ?? null,
            urgency:
              currentQty === 0 ? "critical" : currentQty < reorderQty / 2 ? "high" : "medium",
          };
        })
        .sort((a, b) => {
          const urgOrder: Record<string, number> = { critical: 0, high: 1, medium: 2 };
          return (urgOrder[a.urgency] ?? 9) - (urgOrder[b.urgency] ?? 9);
        });

      return {
        items: lowStock,
        summary: {
          totalLowStock: lowStock.length,
          critical: lowStock.filter((i) => i.urgency === "critical").length,
          high: lowStock.filter((i) => i.urgency === "high").length,
          medium: lowStock.filter((i) => i.urgency === "medium").length,
          estimatedReorderCost: lowStock.reduce((s, v) => s + v.estimatedReorderCost, 0),
        },
      };
    });
  },

  // ── Phase 3: POS & Dining ─────────────────────────────────────────────────────

  async getPOSSales(withTenant: WithTenantFn, startDate: string, endDate: string) {
    const { start, end } = utcRange(startDate, endDate);

    return withTenant(async (db) => {
      const orders = await db.posOrder.findMany({
        where: { createdAt: { gte: start, lt: end } },
        select: {
          total: true,
          items: {
            select: {
              posItemId: true,
              name: true,
              quantity: true,
              lineTotal: true,
              posItem: {
                select: { category: { select: { name: true } } },
              },
            },
          },
        },
      });

      const totalOrders = orders.length;
      const totalRevenue = orders.reduce((s, o) => s + o.total, 0);
      const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

      const itemMap = new Map<string, {
        itemName: string;
        category: string;
        quantitySold: number;
        revenue: number;
      }>();
      const catMap = new Map<string, number>();

      for (const order of orders) {
        for (const item of order.items) {
          const catName = item.posItem?.category?.name ?? "Uncategorized";
          const existing = itemMap.get(item.posItemId) ?? {
            itemName: item.name,
            category: catName,
            quantitySold: 0,
            revenue: 0,
          };
          existing.quantitySold += item.quantity;
          existing.revenue += item.lineTotal;
          itemMap.set(item.posItemId, existing);
          catMap.set(catName, (catMap.get(catName) ?? 0) + item.lineTotal);
        }
      }

      const allItems = [...itemMap.entries()].map(([posItemId, v]) => ({ posItemId, ...v }));
      const topItems = allItems
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      const catTotal = [...catMap.values()].reduce((s, v) => s + v, 0);
      const byCategory = [...catMap.entries()]
        .map(([category, revenue]) => ({
          category,
          revenue,
          percentage: catTotal > 0 ? Math.round((revenue / catTotal) * 1000) / 10 : 0,
        }))
        .sort((a, b) => b.revenue - a.revenue);

      return {
        topItems,
        byCategory,
        summary: { totalOrders, totalRevenue, avgOrderValue },
      };
    });
  },

  async getQROrders(hotelId: string, startDate: string, endDate: string) {
    try {
      const rows = await adminPrisma.$queryRaw<Array<{
        delivery_type: string;
        payment_preference: string;
        status: string;
        order_count: bigint;
        total_revenue: bigint;
      }>>`
        SELECT
          delivery_type,
          payment_preference,
          status,
          COUNT(*)::bigint            AS order_count,
          COALESCE(SUM(total_amount), 0)::bigint AS total_revenue
        FROM qr_orders
        WHERE hotel_id   = ${hotelId}::uuid
          AND created_at >= ${startDate}::date
          AND created_at <  (${endDate}::date + INTERVAL '1 day')
        GROUP BY delivery_type, payment_preference, status
      `;

      const byDeliveryType = new Map<string, { orderCount: number; revenue: number }>();
      const byPaymentPref  = new Map<string, { orderCount: number; revenue: number }>();
      const byStatus       = new Map<string, { orderCount: number; revenue: number }>();
      let totalOrders = 0;
      let totalRevenue = 0;

      for (const r of rows) {
        const count = Number(r.order_count);
        const rev   = Number(r.total_revenue);
        totalOrders  += count;
        totalRevenue += rev;

        const dt = byDeliveryType.get(r.delivery_type) ?? { orderCount: 0, revenue: 0 };
        dt.orderCount += count; dt.revenue += rev;
        byDeliveryType.set(r.delivery_type, dt);

        const pp = byPaymentPref.get(r.payment_preference) ?? { orderCount: 0, revenue: 0 };
        pp.orderCount += count; pp.revenue += rev;
        byPaymentPref.set(r.payment_preference, pp);

        const st = byStatus.get(r.status) ?? { orderCount: 0, revenue: 0 };
        st.orderCount += count; st.revenue += rev;
        byStatus.set(r.status, st);
      }

      return {
        available: true as const,
        byDeliveryType: [...byDeliveryType.entries()].map(([deliveryType, v]) => ({ deliveryType, ...v })).sort((a, b) => b.orderCount - a.orderCount),
        byPaymentPreference: [...byPaymentPref.entries()].map(([paymentPreference, v]) => ({ paymentPreference, ...v })).sort((a, b) => b.orderCount - a.orderCount),
        byStatus: [...byStatus.entries()].map(([status, v]) => ({ status, ...v })).sort((a, b) => b.orderCount - a.orderCount),
        summary: { totalOrders, totalRevenue },
      };
    } catch {
      return { available: false as const, error: "QR Orders data unavailable" };
    }
  },
};
