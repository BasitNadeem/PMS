import { adminPrisma } from "@pms/db";
import type { BriefingData } from "./formatBriefingMessage";
import { getPKTDayRange, getCurrentPKTDate } from "../lib/timezone";

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
    occupiedRooms,
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
  ] = await Promise.all([
    adminPrisma.hotel.findFirst({
      where:  { id: hotelId },
      select: { name: true, settings: true },
    }),

    adminPrisma.room.count({ where: { hotelId, isActive: true } }),

    adminPrisma.room.count({ where: { hotelId, status: "OCCUPIED" } }),

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
  ]);

  const hotelName   = hotel?.name ?? "Hotel";
  const totalRooms_ = totalRooms ?? 0;
  const occupied    = occupiedRooms ?? 0;
  const oRate       = totalRooms_ > 0 ? Math.round((occupied / totalRooms_) * 100) : 0;

  const dateStr = new Date().toLocaleDateString("en-PK", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  return {
    hotelName:           hotelName,
    date:                dateStr,
    occupancy: {
      occupiedRooms:     occupied,
      totalRooms:        totalRooms_,
      occupancyRate:     oRate,
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
    openFoliosWithBalance:  openFolioCount,
    anomalies:              [],
  };
}
