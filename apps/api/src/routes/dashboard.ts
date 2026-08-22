import { Router } from "express";
import { HousekeepingTaskStatus, MaintenanceStatus, PaymentStatus, Prisma } from "@pms/db";
import { authenticate } from "../middleware/auth";
import { tenantMiddleware } from "../middleware/tenant";
import { computeMaintenanceSummary } from "../services/MaintenanceService";
import { OperationalReminderService } from "../services/OperationalReminderService";
import { addDays, getBusinessDayWindow, getOperationalBusinessDate, readShiftSchedule, timeToMinutes } from "../lib/shiftSchedule";
import { dateOnlyUTC, PKT_OFFSET_HOURS } from "../lib/timezone";

const router: Router = Router();
router.use(authenticate, tenantMiddleware);

router.get("/", async (req, res) => {
  const operationalRemindersPromise = OperationalReminderService.getForDashboard(
    req.withTenant,
    req.user!.hotelId,
    req.user!.permissions,
  );
  // "Today" on this dashboard is the hotel's operating day, not the calendar day
  // and not the UTC day. It opens and closes at the shift boundaries the property
  // configured, so a check-in at 02:00 still belongs to the shift that is on duty
  // rather than jumping to a new date the front desk has not started yet.
  const hotelRow = await req.withTenant((db) =>
    db.hotel.findUniqueOrThrow({ where: { id: req.user!.hotelId }, select: { settings: true } })
  );
  const hotelSettings = (hotelRow.settings as Record<string, unknown> | null) ?? {};
  const businessDate  = getOperationalBusinessDate(hotelSettings);
  const previousDate  = addDays(businessDate, -1);

  // Timestamp columns (createdAt, charge_date) need the real instant window.
  const { start: todayStart,     end: todayEnd }     = getBusinessDayWindow(businessDate, hotelSettings);
  const { start: yesterdayStart, end: yesterdayEnd } = getBusinessDayWindow(previousDate, hotelSettings);

  // Calendar-date columns (@db.Date) are stored at UTC midnight and must be
  // matched against the date itself, never against the instant window above.
  const dayDate     = dateOnlyUTC(businessDate);
  const prevDayDate = dateOnlyUTC(previousDate);

  // "Upcoming" window for the front-desk card's third tab — the 7 days AFTER today,
  // starting tomorrow so it never overlaps with the "Arrivals" (today) tab.
  const upcomingFrom = dateOnlyUTC(addDays(businessDate, 1));
  const upcomingTo   = dateOnlyUTC(addDays(businessDate, 7));

  const dataPromise = req.withTenant(async (db) => {
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
      upcomingReservations,
      invLowStockRows,
      invOutOfStockRows,
      arrivalsYesterday,
      departuresYesterday,
      checkedInYesterday,
      revenueYesterdayAgg,
      departuresToCollectRaw,
      scheduleArrivalsRaw,
      scheduleDeparturesRaw,
      scheduleHousekeepingRaw,
    ] = await Promise.all([
      db.room.count(),
      db.room.count({ where: { status: "OCCUPIED" } }),
      db.room.count({ where: { status: "VACANT_CLEAN" } }),
      db.reservation.count({
        where: {
          checkInDate: dayDate,
          status: { in: ["CHECKED_IN", "CONFIRMED"] },
        },
      }),
      db.reservation.count({
        where: {
          checkOutDate: dayDate,
          status: "CHECKED_IN",
        },
      }),
      db.reservation.count({
        where: { createdAt: { gte: todayStart, lte: todayEnd } },
      }),
      db.reservation.count({ where: { status: "CONFIRMED" } }),
      db.reservation.count({ where: { status: "CHECKED_IN" } }),
      db.reservation.count({ where: { status: "ENQUIRY" } }),
      // Revenue today = folio charges + POS orders NOT already posted to a folio
      // (folio-posted POS items are already in folio_items; excluding them avoids double-counting)
      db.$queryRaw<[{ total: bigint }]>(Prisma.sql`
        SELECT COALESCE(SUM(amount), 0)::bigint AS total
        FROM (
          SELECT amount FROM folio_items
          WHERE hotel_id = ${req.user!.hotelId}::uuid
            AND charge_date >= ${todayStart} AND charge_date <= ${todayEnd}
            AND type != 'DISCOUNT'
            AND is_voided = false
          UNION ALL
          SELECT total AS amount FROM pos_orders
          WHERE hotel_id = ${req.user!.hotelId}::uuid
            AND created_at >= ${todayStart} AND created_at <= ${todayEnd}
            AND is_posted_to_folio = false
        ) _combined
      `),
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
          guest: { select: { id: true, fullName: true } },
          rooms: {
            take: 1,
            include: { room: { select: { number: true } } },
          },
        },
      }),
      // Front-desk card's "Upcoming" tab — next 7 days of arrivals, earliest first.
      db.reservation.findMany({
        where: {
          checkInDate: { gte: upcomingFrom, lte: upcomingTo },
          status: { notIn: ["CANCELLED", "NO_SHOW"] },
        },
        take: 20,
        orderBy: { checkInDate: "asc" },
        include: {
          guest: { select: { id: true, fullName: true } },
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
          checkInDate: prevDayDate,
          status: { notIn: ["CANCELLED", "NO_SHOW"] },
        },
      }),
      db.reservation.count({
        where: {
          checkOutDate: prevDayDate,
          status: "CHECKED_OUT",
        },
      }),
      // Reservations that were occupying a room at any point yesterday — approximates yesterday's in-house count.
      db.reservation.count({
        where: {
          checkInDate:  { lte: prevDayDate },
          checkOutDate: { gt: prevDayDate },
          status: { notIn: ["CANCELLED", "NO_SHOW"] },
        },
      }),
      db.$queryRaw<[{ total: bigint }]>(Prisma.sql`
        SELECT COALESCE(SUM(amount), 0)::bigint AS total
        FROM (
          SELECT amount FROM folio_items
          WHERE hotel_id = ${req.user!.hotelId}::uuid
            AND charge_date >= ${yesterdayStart} AND charge_date <= ${yesterdayEnd}
            AND type != 'DISCOUNT'
            AND is_voided = false
          UNION ALL
          SELECT total AS amount FROM pos_orders
          WHERE hotel_id = ${req.user!.hotelId}::uuid
            AND created_at >= ${yesterdayStart} AND created_at <= ${yesterdayEnd}
            AND is_posted_to_folio = false
        ) _combined
      `),
      // Money to collect — today's departing guests with an outstanding folio balance.
      db.reservation.findMany({
        where: {
          checkOutDate: dayDate,
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
      // Live schedule — today's arrivals. actualCheckIn (real) if already checked in,
      // otherwise the event has no real timestamp yet and falls back to checkInTime.
      // CHECKED_OUT is included so guests who arrived and departed today still appear.
      db.reservation.findMany({
        where: {
          checkInDate: dayDate,
          status: { in: ["CHECKED_IN", "CONFIRMED", "CHECKED_OUT"] },
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
          checkOutDate: dayDate,
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
          scheduledDate: dayDate,
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
    const defaultCheckInTime  = typeof hotelSettings.checkInTime  === "string" ? hotelSettings.checkInTime  : "14:00";
    const defaultCheckOutTime = typeof hotelSettings.checkOutTime === "string" ? hotelSettings.checkOutTime : "12:00";

    function hhmm(d: Date): string {
      return new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit", minute: "2-digit", hour12: false,
        timeZone: "Asia/Karachi",
      }).format(d);
    }

    // `at` is the real instant when the event actually happened, and null when it
    // has not happened yet and `time` is only the hotel's configured hour. The
    // two are positioned on the axis by different rules — see below.
    const scheduleEvents: {
      id: string; time: string; at: Date | null; type: string; label: string; sublabel: string;
      isDone: boolean; isVip?: boolean; taskType?: string; hasIssue?: boolean; balanceDue?: number;
    }[] = [];

    for (const r of scheduleArrivalsRaw) {
      const roomNum = r.rooms[0]?.room.number ?? "—";
      scheduleEvents.push({
        id:       `arr-${r.id}`,
        time:     r.actualCheckIn ? hhmm(r.actualCheckIn) : defaultCheckInTime,
        at:       r.actualCheckIn,
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
        at:         r.actualCheckOut,
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
        at,
        type:     "housekeeping",
        label:    `Room ${t.room.number}`,
        sublabel: t.taskType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        isDone:   !!t.completedAt,
        taskType: t.taskType,
        hasIssue: t.hasIssue,
      });
    }
    // Position every event as minutes since the business day opened. The client
    // never has to know the hotel's timezone to place these.
    //
    // Anything that has already happened is placed from its real instant. Its
    // wall-clock string cannot do that job: arrivals are selected by checkInDate,
    // a calendar column, so a guest whose stay starts today may have walked in at
    // 01:46 — before this business day opened at 06:00. Reading "01:46" off the
    // clock and wrapping it with (time - dayStart + 1440) % 1440 put that guest
    // at 01:46 *tomorrow*: a completed check-in drawn hours into the future, with
    // the axis stretched to reach it, so at 18:20 the NOW marker sat 13% along a
    // bar that ran to 03:00. Clamping the true offset puts them at the day's
    // opening, which is the earliest point the timeline has.
    //
    // Events that have not happened yet have no instant — only the hotel's
    // configured check-in/out hour — and there the wrap is right: a property that
    // checks out at 01:00 means 01:00 at the END of its business day.
    const dayStartMin = timeToMinutes(readShiftSchedule(hotelSettings).morningStart);
    const dayStartMs  = todayStart.getTime();
    const schedule = scheduleEvents
      .map(({ at, ...e }) => ({
        ...e,
        offsetMin: at
          ? Math.min(1440, Math.max(0, Math.round((at.getTime() - dayStartMs) / 60_000)))
          : (timeToMinutes(e.time) - dayStartMin + 1440) % 1440,
      }))
      .sort((a, b) => a.offsetMin - b.offsetMin);

    return {
      occupancy: { totalRooms, occupiedRooms, availableRooms, occupancyRate },
      today: { arrivalsToday, departuresToday, newBookingsToday, arrivalsYesterday, departuresYesterday },
      reservations: { confirmedCount, checkedInCount, pendingCount, checkedInYesterday },
      revenue: {
        revenueToday:        Number(revenueTodayAgg[0]?.total    ?? 0),
        paymentsToday:       paymentsTodayAgg._sum.amount        ?? 0,
        outstandingBalance:  outstandingAgg._sum.balanceDue      ?? 0,
        revenueYesterday:    Number(revenueYesterdayAgg[0]?.total ?? 0),
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
        guestId:            r.guest.id,
        roomNumber:         r.rooms[0]?.room.number ?? null,
        groupId:            r.groupId,
        isVip:              r.isVip,
      })),
      upcomingReservations: upcomingReservations.map((r) => ({
        id:                 r.id,
        confirmationNumber: r.confirmationNumber,
        status:             r.status,
        checkInDate:        r.checkInDate,
        checkOutDate:       r.checkOutDate,
        guestName:          r.guest.fullName,
        guestId:            r.guest.id,
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
      schedule,
      businessDay: {
        date:     businessDate,
        startsAt: todayStart.toISOString(),
        endsAt:   todayEnd.toISOString(),
      },
    };
  });

  const [data, operationalReminders] = await Promise.all([
    dataPromise,
    operationalRemindersPromise,
  ]);
  res.json({ data: { ...data, operationalReminders } });
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

  // Same operating-day basis as the dashboard itself, so the last bar on the
  // chart is the day the front desk is actually working, not the UTC date.
  const hotelRow = await req.withTenant((db) =>
    db.hotel.findUniqueOrThrow({ where: { id: req.user!.hotelId }, select: { settings: true } })
  );
  const hotelSettings = (hotelRow.settings as Record<string, unknown> | null) ?? {};
  const businessDate  = getOperationalBusinessDate(hotelSettings);
  const firstDate     = addDays(businessDate, -(days - 1));

  const { end: todayEnd }      = getBusinessDayWindow(businessDate, hotelSettings);
  const { start: rangeStart }  = getBusinessDayWindow(firstDate, hotelSettings);

  // Postgres holds these as `timestamp without time zone` in UTC. Shifting each
  // row by (PKT offset - the hotel's Morning boundary) moves it into a space
  // where plain date_trunc lands it on the business day it belongs to, so a
  // 02:00 charge groups with the shift that took it rather than the next day.
  const bucketShiftMinutes =
    PKT_OFFSET_HOURS * 60 - timeToMinutes(readShiftSchedule(hotelSettings).morningStart);

  const data = await req.withTenant(async (db) => {
    // make_interval() is unusable here: Prisma binds JS numbers as bigint and no
    // make_interval overload accepts one. Multiplying a unit interval does.
    const shifted = Prisma.sql`(bucket_date + (${bucketShiftMinutes} * interval '1 minute'))`;
    const bucketColSql = bucketWeekly
      ? Prisma.sql`date_trunc('week', ${shifted})`
      : Prisma.sql`date_trunc('day', ${shifted})`;
    const rows = await db.$queryRaw<{ bucket: Date; total: bigint }[]>(
      Prisma.sql`
        SELECT ${bucketColSql} AS bucket, COALESCE(SUM(amount), 0)::bigint AS total
        FROM (
          SELECT amount, charge_date AS bucket_date FROM folio_items
          WHERE hotel_id = ${req.user!.hotelId}::uuid
            AND type != 'DISCOUNT'
            AND is_voided = false
            AND charge_date >= ${rangeStart}
            AND charge_date <= ${todayEnd}
          UNION ALL
          SELECT total AS amount, created_at AS bucket_date FROM pos_orders
          WHERE hotel_id = ${req.user!.hotelId}::uuid
            AND created_at >= ${rangeStart}
            AND created_at <= ${todayEnd}
            AND is_posted_to_folio = false
        ) _combined
        GROUP BY bucket
        ORDER BY bucket ASC
      `
    );

    const trend: { date: string; amount: number }[] = [];
    const step = bucketWeekly ? 7 : 1;
    for (let i = days - 1; i >= 0; i -= step) {
      const d = dateOnlyUTC(addDays(businessDate, -i));
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
