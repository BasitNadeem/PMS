import { adminPrisma } from "@pms/db";
import type { BriefingData } from "./formatBriefingMessage";
import { getPKTDayRange, getCurrentPKTDate } from "../lib/timezone";
import { ExpenseService } from "../services/ExpenseService";
import { CashBookService } from "../services/CashBookService";
import { calculateBriefingMetrics } from "./briefingMetrics";

// Mirrors HotelMetricsService's definition so ADR/RevPAR in the briefing match
// what the owner sees in Reports. A CHECKED_OUT stay still consumed the room
// last night, so it counts toward tonight's room revenue.
const ACTIVE_STAY_STATUSES = ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT"] as const;

// Cash the owner could physically count. Bank/JazzCash/Easypaisa balances are
// deliberately excluded — "cash in hand" is a drawer question, not a treasury one.
const PHYSICAL_CASH_ACCOUNTS = new Set(["CASH_DRAWER", "PETTY_CASH"]);

/**
 * Cash balances live in raw-SQL ledger tables and the service throws on any DB
 * error. A briefing must never fail wholesale because one optional figure could
 * not be read, so this degrades to zero and lets the rest of the message go out.
 */
async function safeCashInHand(hotelId: string, asOf: string): Promise<number | null> {
  try {
    // getBalances already drops accounts with no movement, so an empty result
    // means the Balance Book was never used — not that the drawer is empty.
    const accounts = (await CashBookService.getBalances(hotelId, { asOf }))
      .filter((a) => PHYSICAL_CASH_ACCOUNTS.has(a.accountType));
    if (accounts.length === 0) return null;
    return accounts.reduce((sum, a) => sum + a.balance, 0);
  } catch (err) {
    console.error(`[briefing] cash balance unavailable for hotel ${hotelId}:`, err);
    return null;
  }
}

async function safeExpensesToday(hotelId: string, date: string): Promise<number> {
  try {
    return (await ExpenseService.getSummary(hotelId, date, date)).totalAmount;
  } catch (err) {
    console.error(`[briefing] expense total unavailable for hotel ${hotelId}:`, err);
    return 0;
  }
}

export async function collectBriefingData(hotelId: string): Promise<BriefingData> {
  const todayStr = getCurrentPKTDate();
  const [todayY, todayM, todayD] = todayStr.split("-").map(Number);
  const tomorrowDate = new Date(Date.UTC(todayY, todayM - 1, todayD + 1));
  const tomorrowStr = `${tomorrowDate.getUTCFullYear()}-${String(tomorrowDate.getUTCMonth() + 1).padStart(2, "0")}-${String(tomorrowDate.getUTCDate()).padStart(2, "0")}`;

  const { start: todayStart, end: todayEnd } = getPKTDayRange(todayStr);
  const { start: tomorrow, end: dayAfter } = getPKTDayRange(tomorrowStr);

  const [
    hotel,
    totalRooms,
    paymentsToday,
    chargedToday,
    outstandingAgg,
    openFolioCount,
    checkInsToday,
    checkOutsToday,
    newBookingsToday,
    tomorrowArrivals,
    pendingHK,
    checkoutCleansPending,
    openMaintenanceTickets,
    urgentMaintenanceTickets,
    soldRoomNights,
    blockedRooms,
    posToday,
    shiftDiscrepancies,
    expensesToday,
    cashInHand,
  ] = await Promise.all([
    adminPrisma.hotel.findFirst({
      where:  { id: hotelId },
      select: { name: true, settings: true },
    }),

    adminPrisma.room.count({ where: { hotelId, isActive: true } }),

    adminPrisma.payment.aggregate({
      _sum:  { amount: true },
      where: {
        reservation: { hotelId },
        createdAt:   { gte: todayStart, lte: todayEnd },
        status:      "COMPLETED",
        isRefund:    false,
      },
    }),

    adminPrisma.folioItem.aggregate({
      _sum:  { amount: true },
      where: {
        folio:      { reservation: { hotelId } },
        chargeDate: { gte: todayStart, lte: todayEnd },
        isVoided:   false,
      },
    }),

    adminPrisma.folio.aggregate({
      _sum:  { balanceDue: true },
      where: { reservation: { hotelId }, balanceDue: { gt: 0 } },
    }),

    adminPrisma.folio.count({
      where: { reservation: { hotelId }, balanceDue: { gt: 0 } },
    }),

    adminPrisma.reservation.count({
      where: {
        hotelId,
        status:        "CHECKED_IN",
        actualCheckIn: { gte: todayStart, lte: todayEnd },
      },
    }),

    adminPrisma.reservation.count({
      where: {
        hotelId,
        status:         "CHECKED_OUT",
        actualCheckOut: { gte: todayStart, lte: todayEnd },
      },
    }),

    adminPrisma.reservation.count({
      where: { hotelId, createdAt: { gte: todayStart, lte: todayEnd } },
    }),

    adminPrisma.reservation.count({
      where: {
        hotelId,
        checkInDate: { gte: tomorrow, lt: dayAfter },
        status:      { in: ["CONFIRMED", "CHECKED_IN"] },
      },
    }),

    adminPrisma.housekeepingTask.count({
      where: { hotelId, status: "PENDING" },
    }),

    adminPrisma.housekeepingTask.count({
      where: { hotelId, taskType: "CHECKOUT_CLEAN", status: "PENDING" },
    }),

    adminPrisma.maintenanceTicket.count({
      where: { hotelId, status: { in: ["OPEN", "IN_PROGRESS", "AWAITING_PARTS"] } },
    }),

    adminPrisma.maintenanceTicket.count({
      where: { hotelId, status: { in: ["OPEN", "IN_PROGRESS", "AWAITING_PARTS"] }, priority: "URGENT" },
    }),

    // Room-nights sold for tonight, with their rates — the inputs to ADR/RevPAR.
    // Compared against UTC midnights, not the PKT instant range, because these
    // are calendar-date columns: a stay covers tonight when it starts before
    // tomorrow and ends after today.
    adminPrisma.reservationRoom.findMany({
      where: {
        reservation:  { hotelId, status: { in: [...ACTIVE_STAY_STATUSES] } },
        checkInDate:  { lt:  new Date(`${tomorrowStr}T00:00:00.000Z`) },
        checkOutDate: { gt:  new Date(`${todayStr}T00:00:00.000Z`) },
      },
      select: { ratePerNight: true },
    }),

    // Rooms out of service tonight. Reports subtracts these before computing
    // occupancy and RevPAR (sellable = physical - blocked); the briefing has to
    // do the same or the two disagree whenever anything is blocked.
    adminPrisma.roomInventoryBlock.findMany({
      where: {
        hotelId,
        cancelledAt: null,
        // Only active rooms — totalRooms counts active rooms, so a block on a
        // deactivated room would subtract capacity that was never counted.
        room:        { isActive: true },
        startDate:   { lt: new Date(`${tomorrowStr}T00:00:00.000Z`) },
        endDate:     { gt: new Date(`${todayStr}T00:00:00.000Z`) },
      },
      select: { roomId: true },
    }),

    adminPrisma.posOrder.aggregate({
      _sum:   { total: true },
      _count: true,
      where:  { hotelId, createdAt: { gte: todayStart, lte: todayEnd } },
    }),

    // Three days, not one: a discrepancy raised on Friday night still matters on
    // Sunday if nobody has acknowledged it.
    adminPrisma.shiftReport.count({
      where: {
        hotelId,
        discrepancyAlerted: true,
        shiftDate: { gte: new Date(Date.now() - 3 * 86_400_000) },
      },
    }),

    safeExpensesToday(hotelId, todayStr),
    safeCashInHand(hotelId, todayStr),
  ]);

  const hotelName   = hotel?.name ?? "Hotel";
  const totalRooms_ = totalRooms ?? 0;

  // Occupancy is counted from reservations, NOT from room.status. Both are
  // defensible, but HotelMetricsService (what Reports shows) counts reservations,
  // and a briefing that disagrees with the Reports page destroys trust in both.
  // It also makes the three figures reconcile: RevPAR = ADR x occupancy.
  // Sellable, not physical: a room blocked for maintenance cannot be sold, so
  // counting it would understate occupancy and RevPAR. Same denominator as
  // HotelMetricsService, which is what the Reports page renders.
  const outOfService = new Set(blockedRooms.map((b) => b.roomId)).size;
  const metrics = calculateBriefingMetrics({
    date: todayStr,
    physicalRooms: totalRooms_,
    outOfServiceRooms: outOfService,
    roomRates: soldRoomNights.map((roomNight) => roomNight.ratePerNight),
  });

  const dateStr = new Date().toLocaleDateString("en-PK", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  return {
    hotelName:           hotelName,
    date:                dateStr,
    occupancy: {
      occupiedRooms:     metrics.roomsSold,
      // "out of N" means sellable rooms, matching the occupancy percentage.
      totalRooms:        metrics.sellableRooms,
      occupancyRate:     metrics.occupancyRate,
    },
    performance: {
      adr: metrics.adr,
      revpar: metrics.revpar,
      roomRevenue: metrics.expectedRoomRevenue,
    },
    revenue: {
      totalCollected:     paymentsToday._sum.amount    ?? 0,
      totalCharged:       chargedToday._sum.amount     ?? 0,
      outstandingBalance: outstandingAgg._sum.balanceDue ?? 0,
    },
    activity: {
      checkInsToday,
      checkOutsToday,
      newBookingsToday,
    },
    tomorrowArrivals,
    housekeeping: {
      pendingTasks:          pendingHK,
      checkoutCleansPending,
    },
    maintenance: {
      openTickets:   openMaintenanceTickets,
      urgentTickets: urgentMaintenanceTickets,
    },
    posSales: {
      totalRevenue: posToday._sum.total ?? 0,
      orderCount:   posToday._count,
    },
    expensesToday,
    cashInHand,
    shiftDiscrepancies,
    openFoliosWithBalance:  openFolioCount,
    anomalies:              [],
  };
}
