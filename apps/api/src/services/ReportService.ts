import type { TenantTx } from "@pms/db";
import { adminPrisma, FolioItemType, PaymentStatus, HousekeepingTaskStatus, MaintenanceStatus } from "@pms/db";
import { ExpenseService } from "./ExpenseService";

type WithTenantFn = <T>(fn: (db: TenantTx) => Promise<T>) => Promise<T>;

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// ── shared helpers ──────────────────────────────────────────────────────────

function utcDay(dateStr: string): { start: Date; end: Date } {
  const [y, m, d] = dateStr.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, d));
  const end = new Date(Date.UTC(y, m - 1, d + 1));
  return { start, end };
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
        db.reservation.count({ where: { status: "CHECKED_IN", actualCheckIn: { gte: dayStart, lt: dayEnd } } }),
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
          where: { checkInDate: { gte: dayStart, lt: dayEnd }, status: { in: ["CHECKED_IN", "CONFIRMED"] } },
          include: {
            guest: { select: { fullName: true } },
            rooms: { include: { room: { select: { number: true } } } },
          },
        }),

        db.reservation.findMany({
          where: { checkOutDate: { gte: dayStart, lt: dayEnd }, status: { in: ["CHECKED_IN", "CHECKED_OUT"] } },
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
      const totalCollected = collectedAgg._sum.amount ?? 0;
      const outstanding = outstandingAgg._sum.balanceDue ?? 0;

      const byMethod = emptyMethodBreakdown();
      for (const p of paymentsByMethod) {
        byMethod[mapMethodKey(p.method)] += p._sum.amount ?? 0;
      }

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
    const monthStart = new Date(Date.UTC(year, month - 1, 1));
    const monthEndExcl = new Date(Date.UTC(year, month, 1));
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
      ]);

      // ── revenue by day ──────────────────────────────────────────────────
      const revenueByDay = Array.from({ length: daysInMonth }, (_, i) => {
        const day = i + 1;
        const dayStart = new Date(Date.UTC(year, month - 1, day));
        const dayEnd = new Date(Date.UTC(year, month - 1, day + 1));
        const revenue = allPayments
          .filter((p) => p.createdAt >= dayStart && p.createdAt < dayEnd)
          .reduce((s, p) => s + p.amount, 0);
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
      const totalRevenue = allPayments.reduce((s, p) => s + p.amount, 0);
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
};
