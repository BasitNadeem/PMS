import { Router } from "express";
import { FolioItemType, HousekeepingTaskStatus, MaintenanceStatus, PaymentStatus, Prisma } from "@pms/db";
import { authenticate } from "../middleware/auth";
import { tenantMiddleware } from "../middleware/tenant";
import { computeMaintenanceSummary } from "../services/MaintenanceService";

const router = Router();
router.use(authenticate, tenantMiddleware);

router.get("/", async (req, res) => {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setUTCHours(23, 59, 59, 999);

  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setUTCDate(yesterdayStart.getUTCDate() - 1);
  const yesterdayEnd = new Date(todayEnd);
  yesterdayEnd.setUTCDate(yesterdayEnd.getUTCDate() - 1);

  const data = await req.withTenant(async (db) => {
    const [
      totalRooms,
      occupiedRooms,
      availableRooms,
      arrivalsToday,
      departuresToday,
      newBookingsToday,
      confirmedCount,
      checkedInCount,
      pendingCount,
      revenueTodayAgg,
      paymentsTodayAgg,
      outstandingAgg,
      pendingTasks,
      inProgressTasks,
      checkoutCleansPending,
      openMaintenanceTickets,
      recentReservations,
      invLowStockRows,
      invOutOfStockRows,
      arrivalsYesterday,
      departuresYesterday,
      checkedInYesterday,
      revenueYesterdayAgg,
      departuresToCollectRaw,
      hotelSettingsRow,
      scheduleArrivalsRaw,
      scheduleDeparturesRaw,
      scheduleHousekeepingRaw,
    ] = await Promise.all([
      db.room.count(),
      db.room.count({ where: { status: "OCCUPIED" } }),
      db.room.count({ where: { status: "VACANT_CLEAN" } }),
      db.reservation.count({
        where: {
          checkInDate: { gte: todayStart, lte: todayEnd },
          status: { in: ["CHECKED_IN", "CONFIRMED"] },
        },
      }),
      db.reservation.count({
        where: {
          checkOutDate: { gte: todayStart, lte: todayEnd },
          status: "CHECKED_IN",
        },
      }),
      db.reservation.count({
        where: { createdAt: { gte: todayStart, lte: todayEnd } },
      }),
      db.reservation.count({ where: { status: "CONFIRMED" } }),
      db.reservation.count({ where: { status: "CHECKED_IN" } }),
      db.reservation.count({ where: { status: "ENQUIRY" } }),
      db.folioItem.aggregate({
        _sum: { amount: true },
        where: {
          chargeDate: { gte: todayStart, lte: todayEnd },
          type: { not: FolioItemType.DISCOUNT },
          isVoided: false,
        },
      }),
      db.payment.aggregate({
        _sum: { amount: true },
        where: {
          createdAt: { gte: todayStart, lte: todayEnd },
          status: PaymentStatus.COMPLETED,
          isRefund: false,
        },
      }),
      db.folio.aggregate({
        _sum: { balanceDue: true },
        where: { balanceDue: { gt: 0 } },
      }),
      db.housekeepingTask.count({ where: { status: HousekeepingTaskStatus.PENDING } }),
      db.housekeepingTask.count({ where: { status: HousekeepingTaskStatus.IN_PROGRESS } }),
      db.housekeepingTask.count({
        where: { taskType: "CHECKOUT_CLEAN", status: HousekeepingTaskStatus.PENDING },
      }),
      db.maintenanceTicket.findMany({
        where:  { status: { in: [MaintenanceStatus.OPEN, MaintenanceStatus.IN_PROGRESS, MaintenanceStatus.AWAITING_PARTS] } },
        select: { id: true, createdAt: true, priority: true, status: true },
      }),
      db.reservation.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        include: {
          guest: { select: { fullName: true } },
          rooms: {
            take: 1,
            include: { room: { select: { number: true } } },
          },
        },
      }),
      db.$queryRaw<[{ count: bigint }]>(
        Prisma.sql`SELECT COUNT(*) as count FROM inventory_items WHERE hotel_id = ${req.user!.hotelId}::uuid AND is_active = true AND current_stock <= reorder_level`
      ),
      db.$queryRaw<[{ count: bigint }]>(
        Prisma.sql`SELECT COUNT(*) as count FROM inventory_items WHERE hotel_id = ${req.user!.hotelId}::uuid AND is_active = true AND current_stock <= 0`
      ),
      // Day-over-day comparisons — power the KPI trend badges with real deltas.
      db.reservation.count({
        where: {
          checkInDate: { gte: yesterdayStart, lte: yesterdayEnd },
          status: { notIn: ["CANCELLED", "NO_SHOW"] },
        },
      }),
      db.reservation.count({
        where: {
          checkOutDate: { gte: yesterdayStart, lte: yesterdayEnd },
          status: "CHECKED_OUT",
        },
      }),
      // Reservations that were occupying a room at any point yesterday — approximates yesterday's in-house count.
      db.reservation.count({
        where: {
          checkInDate:  { lte: yesterdayEnd },
          checkOutDate: { gt: yesterdayEnd },
          status: { notIn: ["CANCELLED", "NO_SHOW"] },
        },
      }),
      db.folioItem.aggregate({
        _sum: { amount: true },
        where: {
          chargeDate: { gte: yesterdayStart, lte: yesterdayEnd },
          type: { not: FolioItemType.DISCOUNT },
          isVoided: false,
        },
      }),
      // Money to collect — today's departing guests with an outstanding folio balance.
      db.reservation.findMany({
        where: {
          checkOutDate: { gte: todayStart, lte: todayEnd },
          status: "CHECKED_IN",
          folio: { balanceDue: { gt: 0 } },
        },
        take: 6,
        orderBy: { checkOutDate: "asc" },
        include: {
          guest: { select: { fullName: true } },
          rooms: { take: 1, include: { room: { select: { number: true } } } },
          folio: { select: { balanceDue: true } },
        },
      }),
      // Hotel's configured standard check-in/out times — used for the live schedule's
      // "expected" events that haven't actually happened yet (no real timestamp exists).
      db.hotel.findUnique({ where: { id: req.user!.hotelId }, select: { settings: true } }),
      // Live schedule — today's arrivals. actualCheckIn (real) if already checked in,
      // otherwise the event has no real timestamp yet and falls back to checkInTime.
      db.reservation.findMany({
        where: {
          checkInDate: { gte: todayStart, lte: todayEnd },
          status: { in: ["CHECKED_IN", "CONFIRMED"] },
        },
        take: 15,
        orderBy: { checkInDate: "asc" },
        include: {
          guest: { select: { fullName: true } },
          rooms: { take: 1, include: { room: { select: { number: true } } } },
        },
      }),
      // Live schedule — today's departures, checked-out or still pending.
      db.reservation.findMany({
        where: {
          checkOutDate: { gte: todayStart, lte: todayEnd },
          status: { in: ["CHECKED_IN", "CHECKED_OUT"] },
        },
        take: 15,
        orderBy: { checkOutDate: "asc" },
        include: {
          guest: { select: { fullName: true } },
          rooms: { take: 1, include: { room: { select: { number: true } } } },
          folio: { select: { balanceDue: true } },
        },
      }),
      // Live schedule — housekeeping tasks with a genuine timestamp (started or completed).
      // Pending tasks have no real time basis and are deliberately excluded.
      db.housekeepingTask.findMany({
        where: {
          scheduledDate: { gte: todayStart, lt: todayEnd },
          status: { in: [HousekeepingTaskStatus.IN_PROGRESS, HousekeepingTaskStatus.COMPLETED] },
        },
        take: 15,
        include: { room: { select: { number: true } } },
      }),
    ]);

    const occupancyRate =
      totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 1000) / 10 : 0;

    // Live schedule — every event uses either a real timestamp (actualCheckIn,
    // actualCheckOut, housekeeping startedAt/completedAt) or, for events that
    // haven't happened yet, the hotel's own configured check-in/out time.
    // Nothing here is a per-guest guess.
    const hotelSettings = (hotelSettingsRow?.settings as Record<string, unknown>) ?? {};
    const defaultCheckInTime  = typeof hotelSettings.checkInTime  === "string" ? hotelSettings.checkInTime  : "14:00";
    const defaultCheckOutTime = typeof hotelSettings.checkOutTime === "string" ? hotelSettings.checkOutTime : "12:00";

    function hhmm(d: Date): string {
      return new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit", minute: "2-digit", hour12: false,
        timeZone: "Asia/Karachi",
      }).format(d);
    }

    const scheduleEvents: {
      id: string; time: string; type: string; label: string; sublabel: string;
      isDone: boolean; isVip?: boolean; taskType?: string; hasIssue?: boolean; balanceDue?: number;
    }[] = [];

    for (const r of scheduleArrivalsRaw) {
      const roomNum = r.rooms[0]?.room.number ?? "—";
      scheduleEvents.push({
        id:       `arr-${r.id}`,
        time:     r.actualCheckIn ? hhmm(r.actualCheckIn) : defaultCheckInTime,
        type:     "checkin",
        label:    r.guest.fullName,
        sublabel: `Room ${roomNum}`,
        isDone:   !!r.actualCheckIn,
        isVip:    r.isVip,
      });
    }
    for (const r of scheduleDeparturesRaw) {
      const roomNum = r.rooms[0]?.room.number ?? "—";
      scheduleEvents.push({
        id:         `dep-${r.id}`,
        time:       r.actualCheckOut ? hhmm(r.actualCheckOut) : defaultCheckOutTime,
        type:       "checkout",
        label:      r.guest.fullName,
        sublabel:   `Room ${roomNum}`,
        isDone:     !!r.actualCheckOut,
        balanceDue: r.folio?.balanceDue ?? 0,
      });
    }
    for (const t of scheduleHousekeepingRaw) {
      const at = t.completedAt ?? t.startedAt;
      if (!at) continue;
      scheduleEvents.push({
        id:       `hk-${t.id}`,
        time:     hhmm(at),
        type:     "housekeeping",
        label:    `Room ${t.room.number}`,
        sublabel: t.taskType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        isDone:   !!t.completedAt,
        taskType: t.taskType,
        hasIssue: t.hasIssue,
      });
    }
    scheduleEvents.sort((a, b) => a.time.localeCompare(b.time));

    return {
      occupancy: { totalRooms, occupiedRooms, availableRooms, occupancyRate },
      today: { arrivalsToday, departuresToday, newBookingsToday, arrivalsYesterday, departuresYesterday },
      reservations: { confirmedCount, checkedInCount, pendingCount, checkedInYesterday },
      revenue: {
        revenueToday:        revenueTodayAgg._sum.amount  ?? 0,
        paymentsToday:       paymentsTodayAgg._sum.amount ?? 0,
        outstandingBalance:  outstandingAgg._sum.balanceDue ?? 0,
        revenueYesterday:    revenueYesterdayAgg._sum.amount ?? 0,
      },
      housekeeping: { pendingTasks, inProgressTasks, checkoutCleansPending },
      maintenance: computeMaintenanceSummary(openMaintenanceTickets),
      inventory: {
        lowStockCount:   Number(invLowStockRows[0]?.count  ?? 0),
        outOfStockCount: Number(invOutOfStockRows[0]?.count ?? 0),
      },
      recentReservations: recentReservations.map((r) => ({
        id:                 r.id,
        confirmationNumber: r.confirmationNumber,
        status:             r.status,
        checkInDate:        r.checkInDate,
        checkOutDate:       r.checkOutDate,
        guestName:          r.guest.fullName,
        roomNumber:         r.rooms[0]?.room.number ?? null,
        groupId:            r.groupId,
        isVip:              r.isVip,
      })),
      departuresToCollect: {
        total: departuresToCollectRaw.reduce((sum, r) => sum + (r.folio?.balanceDue ?? 0), 0),
        items: departuresToCollectRaw.map((r) => ({
          id:         r.id,
          guestName:  r.guest.fullName,
          roomNumber: r.rooms[0]?.room.number ?? null,
          balanceDue: r.folio?.balanceDue ?? 0,
        })),
      },
      schedule: scheduleEvents,
    };
  });

  res.json({ data });
});

const REVENUE_TREND_RANGES = { "14d": 14, "30d": 30, "6m": 182 } as const;
type RevenueTrendRange = keyof typeof REVENUE_TREND_RANGES;

// GET /api/dashboard/revenue-trend?range=14d|30d|6m
// 14d/30d are plotted daily; 6m is bucketed weekly so the chart stays readable
// (182 individual daily points would be unreadable noise).
router.get("/revenue-trend", async (req, res) => {
  const rangeParam = req.query.range;
  const range: RevenueTrendRange =
    typeof rangeParam === "string" && rangeParam in REVENUE_TREND_RANGES
      ? (rangeParam as RevenueTrendRange)
      : "14d";
  const days = REVENUE_TREND_RANGES[range];
  const bucketWeekly = range === "6m";

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setUTCHours(23, 59, 59, 999);
  const rangeStart = new Date(todayStart);
  rangeStart.setUTCDate(rangeStart.getUTCDate() - (days - 1));

  const data = await req.withTenant(async (db) => {
    const bucketSql = bucketWeekly ? Prisma.sql`date_trunc('week', charge_date)` : Prisma.sql`date_trunc('day', charge_date)`;
    const rows = await db.$queryRaw<{ bucket: Date; total: bigint }[]>(
      Prisma.sql`
        SELECT ${bucketSql} as bucket, COALESCE(SUM(amount), 0)::bigint as total
        FROM folio_items
        WHERE hotel_id = ${req.user!.hotelId}::uuid
          AND type != 'DISCOUNT'
          AND is_voided = false
          AND charge_date >= ${rangeStart}
          AND charge_date <= ${todayEnd}
        GROUP BY bucket
        ORDER BY bucket ASC
      `
    );

    const trend: { date: string; amount: number }[] = [];
    const step = bucketWeekly ? 7 : 1;
    for (let i = days - 1; i >= 0; i -= step) {
      const d = new Date(todayStart);
      d.setUTCDate(d.getUTCDate() - i);
      // Align to the same week-start the SQL date_trunc('week', ...) would produce (Monday).
      if (bucketWeekly) {
        const dow = (d.getUTCDay() + 6) % 7; // 0=Mon
        d.setUTCDate(d.getUTCDate() - dow);
      }
      const iso = d.toISOString().slice(0, 10);
      const row = rows.find((r) => new Date(r.bucket).toISOString().slice(0, 10) === iso);
      if (!trend.some((t) => t.date === iso)) {
        trend.push({ date: iso, amount: row ? Number(row.total) : 0 });
      }
    }
    return trend;
  });

  res.json({ data });
});

export default router;
