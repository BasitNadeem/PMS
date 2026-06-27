import { adminPrisma } from "@pms/db";
import type { BriefingData } from "./formatBriefingMessage";

export async function collectBriefingData(hotelId: string): Promise<BriefingData> {
  const now = new Date();

  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const dayAfter = new Date(tomorrow);
  dayAfter.setDate(dayAfter.getDate() + 1);

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

  const dateStr = now.toLocaleDateString("en-PK", {
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
