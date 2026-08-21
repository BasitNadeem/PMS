import { Prisma } from "@pms/db";
import type { TenantTx } from "@pms/db";
import { BusinessDaySnapshotService } from "./BusinessDaySnapshotService";
import { HotelMetricsService } from "./HotelMetricsService";
import { getPKTDayRange } from "../lib/timezone";
import { AppError } from "../utils/AppError";
import { paginationMeta } from "../utils/pagination";

type WithTenantFn = <T>(fn: (db: TenantTx) => Promise<T>) => Promise<T>;

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

interface QrItemRow {
  item_name: string;
  quantity: bigint;
  revenue: bigint;
}

type BusinessDaySnapshot = Awaited<ReturnType<typeof BusinessDaySnapshotService.build>>;

async function getQrTopItems(
  db: TenantTx,
  hotelId: string,
  activityStart: Date,
  activityEnd: Date,
): Promise<QrItemRow[]> {
  try {
    return await db.$queryRaw<QrItemRow[]>`
      SELECT qoi.item_name,
             COALESCE(SUM(qoi.quantity), 0)::bigint AS quantity,
             COALESCE(SUM(qoi.subtotal), 0)::bigint AS revenue
      FROM qr_order_items qoi
      JOIN qr_orders qo ON qo.id = qoi.order_id
      WHERE qo.hotel_id = ${hotelId}::uuid
        AND qo.created_at >= ${activityStart}
        AND qo.created_at < ${activityEnd}
        AND qo.status <> 'cancelled'
      GROUP BY qoi.item_name
      ORDER BY revenue DESC
      LIMIT 10
    `;
  } catch (error) {
    // QR tables are intentionally raw-SQL managed. A missing optional table must
    // not prevent the manager's core morning report from loading.
    console.warn("[early-bird] QR item summary unavailable", error);
    return [];
  }
}

export const EarlyBirdReportService = {
  async getReport(
    withTenant: WithTenantFn,
    hotelId: string,
    reportDate: string,
    forecastDays: number,
    actorId: string,
  ) {
    return withTenant(async (db) => {
      const reportDay = getPKTDayRange(reportDate);
      const forecastEnd = addDays(reportDate, forecastDays - 1);
      const auditDate = addDays(reportDate, -1);
      const latestAudit = await db.nightAuditRecord.findFirst({
        where: {
          hotelId,
          businessDate: new Date(`${auditDate}T00:00:00.000Z`),
        },
        include: { earlyBirdReport: true },
        orderBy: { revision: "desc" },
      });
      if (!latestAudit) {
        throw new AppError(
          409,
          `Complete Night Audit for ${auditDate} before opening the Early Bird Report`,
        );
      }
      if (latestAudit.earlyBirdReport) {
        const archived = asObject(latestAudit.earlyBirdReport.snapshot);
        if (!archived) throw new AppError(500, "The archived Early Bird Report is invalid");
        return {
          ...archived,
          archiveId: latestAudit.earlyBirdReport.id,
          auditReversedAt: latestAudit.reversedAt?.toISOString() ?? null,
        };
      }
      if (latestAudit.reversedAt) {
        throw new AppError(
          409,
          `Night Audit for ${auditDate} was reversed. Close the business day again before generating a new Early Bird Report`,
        );
      }

      const [hotel, outlook, arrivals, departures, stayovers, roomStatuses,
        housekeeping, maintenance, outstandingFolios, outstandingSummary, lowStock, latestNightShift] = await Promise.all([
        db.hotel.findUniqueOrThrow({ where: { id: hotelId }, select: { name: true } }),
        HotelMetricsService.getRangeFromDb(db, reportDate, forecastEnd),
        db.reservation.findMany({
          where: { hotelId, checkInDate: { gte: reportDay.start, lt: reportDay.end }, status: { in: ["CONFIRMED", "CHECKED_IN"] } },
          select: {
            id: true, confirmationNumber: true, status: true, estimatedArrivalTime: true, isVip: true,
            guest: { select: { fullName: true } },
            company: { select: { name: true } },
            group: { select: { name: true } },
            rooms: { select: { room: { select: { number: true } } } },
          },
          orderBy: [{ estimatedArrivalTime: "asc" }, { createdAt: "asc" }],
        }),
        db.reservation.findMany({
          where: { hotelId, checkOutDate: { gte: reportDay.start, lt: reportDay.end }, status: "CHECKED_IN" },
          select: {
            id: true, confirmationNumber: true,
            guest: { select: { fullName: true } },
            folio: { select: { guestBalanceDue: true, companyBalanceDue: true, balanceDue: true } },
            rooms: { select: { room: { select: { number: true } } } },
          },
          orderBy: { checkOutDate: "asc" },
        }),
        db.reservation.count({
          where: { hotelId, status: "CHECKED_IN", checkInDate: { lt: reportDay.start }, checkOutDate: { gt: reportDay.end } },
        }),
        db.room.groupBy({ by: ["status"], where: { hotelId, isActive: true }, _count: { id: true } }),
        db.housekeepingTask.findMany({
          where: {
            hotelId,
            scheduledDate: { gte: reportDay.start, lt: reportDay.end },
            status: { in: ["PENDING", "IN_PROGRESS", "ESCALATED"] },
          },
          select: { id: true, taskType: true, status: true, priority: true, isEscalated: true, room: { select: { number: true } } },
          orderBy: [{ isEscalated: "desc" }, { priority: "desc" }, { createdAt: "asc" }],
        }),
        db.maintenanceTicket.findMany({
          where: { hotelId, status: { in: ["OPEN", "IN_PROGRESS", "AWAITING_PARTS"] } },
          select: { id: true, ticketNumber: true, title: true, priority: true, status: true, room: { select: { number: true } } },
          orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
        }),
        db.folio.findMany({
          where: { hotelId, isOpen: true, balanceDue: { gt: 0 } },
          select: {
            id: true, folioNumber: true, balanceDue: true, guestBalanceDue: true, companyBalanceDue: true,
            reservation: { select: { id: true, confirmationNumber: true, guest: { select: { fullName: true } } } },
          },
          orderBy: { balanceDue: "desc" },
          take: 10,
        }),
        db.folio.aggregate({
          where: { hotelId, isOpen: true, balanceDue: { gt: 0 } },
          _count: { id: true },
          _sum: { balanceDue: true, guestBalanceDue: true, companyBalanceDue: true },
        }),
        db.inventoryItem.findMany({
          where: { hotelId, isActive: true },
          select: { id: true, name: true, unit: true, currentStock: true, reorderLevel: true, parLevel: true },
          orderBy: { name: "asc" },
        }),
        db.shiftReport.findFirst({
          where: {
            hotelId,
            shiftType: "NIGHT",
            signedOffAt: { not: null },
            shiftDate: { lt: reportDay.end },
          },
          select: { shiftDate: true, notes: true, variance: true, varianceReason: true, handoverBriefing: true, signedOffAt: true },
          orderBy: [{ shiftDate: "desc" }, { signedOffAt: "desc" }],
        }),
      ]);

      const auditSnapshotRaw = asObject(latestAudit.snapshot);
      const frozenSnapshot = auditSnapshotRaw?.version === 2 || auditSnapshotRaw?.version === 3;
      if (!frozenSnapshot) {
        throw new AppError(
          409,
          "This older Night Audit does not contain a complete frozen snapshot and cannot generate an immutable Early Bird Report",
        );
      }
      const closedSnapshot = auditSnapshotRaw as unknown as BusinessDaySnapshot;
      const activity = asObject(closedSnapshot.boundaries);
      const activityStart = typeof activity?.activityStartsAt === "string"
        ? new Date(activity.activityStartsAt)
        : getPKTDayRange(auditDate).start;
      const activityEnd = typeof activity?.activityEndsAt === "string"
        ? new Date(activity.activityEndsAt)
        : getPKTDayRange(auditDate).end;

      const [posItems, qrItems] = await Promise.all([
        db.posOrderItem.groupBy({
          by: ["name"],
          where: { order: { hotelId, createdAt: { gte: activityStart, lt: activityEnd } } },
          _sum: { quantity: true, lineTotal: true },
          orderBy: { _sum: { lineTotal: "desc" } },
          take: 10,
        }),
        getQrTopItems(db, hotelId, activityStart, activityEnd),
      ]);

      const roomStatus = Object.fromEntries(roomStatuses.map((row) => [row.status, row._count.id]));
      const lowStockItems = lowStock
        .filter((item) => Number(item.currentStock) <= Number(item.reorderLevel))
        .map((item) => ({
          id: item.id,
          name: item.name,
          unit: item.unit,
          currentStock: Number(item.currentStock),
          reorderLevel: Number(item.reorderLevel),
          parLevel: Number(item.parLevel),
          urgency: Number(item.currentStock) <= 0 ? "CRITICAL" : "LOW",
        }))
        .sort((a, b) => a.currentStock - b.currentStock);

      const report = {
        reportDate,
        generatedAt: new Date().toISOString(),
        archiveId: null as string | null,
        auditReversedAt: null as string | null,
        hotelName: hotel.name,
        closedDay: {
          businessDate: auditDate,
          source: "FROZEN_AUDIT" as const,
          isStale: false,
          auditId: latestAudit.id,
          auditRevision: latestAudit.revision,
          runAt: latestAudit.runAt.toISOString(),
          snapshot: closedSnapshot,
          topSellingItems: {
            pos: posItems.map((item) => ({ name: item.name, quantity: item._sum.quantity ?? 0, revenue: item._sum.lineTotal ?? 0 })),
            qr: qrItems.map((item) => ({ name: item.item_name, quantity: Number(item.quantity), revenue: Number(item.revenue) })),
          },
        },
        today: {
          metrics: outlook.days[0],
          arrivals: arrivals.map((reservation) => ({
            ...reservation,
            guestName: reservation.guest.fullName,
            roomNumbers: reservation.rooms.map((room) => room.room.number),
            companyName: reservation.company?.name ?? null,
            groupName: reservation.group?.name ?? null,
          })),
          departures: departures.map((reservation) => ({
            ...reservation,
            guestName: reservation.guest.fullName,
            roomNumbers: reservation.rooms.map((room) => room.room.number),
            guestBalance: reservation.folio?.guestBalanceDue ?? 0,
            companyBalance: reservation.folio?.companyBalanceDue ?? 0,
            totalBalance: reservation.folio?.balanceDue ?? 0,
          })),
          stayovers,
          roomStatus,
          housekeeping,
          maintenance,
          outstandingFolios: outstandingFolios.map((folio) => ({
            ...folio,
            reservationId: folio.reservation?.id ?? null,
            reservationNumber: folio.reservation?.confirmationNumber ?? null,
            guestName: folio.reservation?.guest.fullName ?? "Unassigned folio",
          })),
          outstandingSummary: {
            count: outstandingSummary._count.id,
            total: outstandingSummary._sum.balanceDue ?? 0,
            guest: outstandingSummary._sum.guestBalanceDue ?? 0,
            company: outstandingSummary._sum.companyBalanceDue ?? 0,
          },
          lowStock: lowStockItems,
          latestNightShift,
        },
        outlook,
      };
      const archive = await db.earlyBirdReportArchive.upsert({
        where: { nightAuditId: latestAudit.id },
        update: {},
        create: {
          hotelId,
          nightAuditId: latestAudit.id,
          reportDate: new Date(`${reportDate}T00:00:00.000Z`),
          forecastDays,
          generatedBy: actorId,
          snapshot: report as unknown as Prisma.InputJsonValue,
        },
      });
      return { ...report, archiveId: archive.id };
    });
  },

  async listArchives(
    withTenant: WithTenantFn,
    hotelId: string,
    params: { page: number; limit: number },
  ) {
    const skip = (params.page - 1) * params.limit;
    const [items, total] = await withTenant((db) => Promise.all([
      db.earlyBirdReportArchive.findMany({
        where: { hotelId },
        include: {
          nightAudit: { select: { revision: true, reversedAt: true } },
        },
        orderBy: { reportDate: "desc" },
        skip,
        take: params.limit,
      }),
      db.earlyBirdReportArchive.count({ where: { hotelId } }),
    ]));
    return {
      data: items.map((item) => ({
        id: item.id,
        reportDate: item.reportDate.toISOString().slice(0, 10),
        forecastDays: item.forecastDays,
        generatedAt: item.generatedAt.toISOString(),
        nightAuditId: item.nightAuditId,
        auditRevision: item.nightAudit.revision,
        auditReversedAt: item.nightAudit.reversedAt?.toISOString() ?? null,
      })),
      meta: paginationMeta(total, params.page, params.limit),
    };
  },
};
