import { Prisma, type TenantTx } from "@pms/db";
import { getCurrentPKTDate } from "../lib/timezone";
import { HotelMetricsService, type HotelMetricDay, type HotelMetricRoomTypeDay } from "./HotelMetricsService";

type WithTenantFn = <T>(fn: (db: TenantTx) => Promise<T>) => Promise<T>;

const SNAPSHOT_HORIZON_DAYS = 180;
const HOUR_MS = 3_600_000;

interface PaceSnapshotPayload {
  version: 1;
  startDate: string;
  endDate: string;
  days: HotelMetricDay[];
  roomTypes: Array<{ id: string; name: string; days: HotelMetricRoomTypeDay[] }>;
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function shiftYear(date: string, years: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  const month = value.getUTCMonth();
  value.setUTCFullYear(value.getUTCFullYear() + years);
  if (value.getUTCMonth() !== month) value.setUTCDate(0);
  return value.toISOString().slice(0, 10);
}

function floorHour(value: Date): Date {
  return new Date(Math.floor(value.getTime() / HOUR_MS) * HOUR_MS);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readPayload(value: unknown): PaceSnapshotPayload | null {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.days) || !Array.isArray(value.roomTypes)) return null;
  if (typeof value.startDate !== "string" || typeof value.endDate !== "string") return null;
  return value as unknown as PaceSnapshotPayload;
}

function summarize(days: Array<Pick<HotelMetricDay, "sellableRooms" | "roomsSold" | "expectedRoomRevenue">>) {
  const sellableRoomNights = days.reduce((sum, day) => sum + day.sellableRooms, 0);
  const roomsSold = days.reduce((sum, day) => sum + day.roomsSold, 0);
  const expectedRoomRevenue = days.reduce((sum, day) => sum + day.expectedRoomRevenue, 0);
  return {
    sellableRoomNights,
    roomsSold,
    expectedRoomRevenue,
    occupancyRate: sellableRoomNights > 0 ? Math.round((roomsSold / sellableRoomNights) * 1_000) / 10 : 0,
    adr: roomsSold > 0 ? Math.round(expectedRoomRevenue / roomsSold) : 0,
    revpar: sellableRoomNights > 0 ? Math.round(expectedRoomRevenue / sellableRoomNights) : 0,
  };
}

function diff(current: ReturnType<typeof summarize>, baseline: ReturnType<typeof summarize> | null, elapsedDays: number | null) {
  if (!baseline || !elapsedDays) return null;
  const roomNights = current.roomsSold - baseline.roomsSold;
  const revenue = current.expectedRoomRevenue - baseline.expectedRoomRevenue;
  return {
    roomNights,
    revenue,
    occupancyPoints: Math.round((current.occupancyRate - baseline.occupancyRate) * 10) / 10,
    roomNightsPerDay: Math.round((roomNights / elapsedDays) * 10) / 10,
    revenuePerDay: Math.round(revenue / elapsedDays),
  };
}

function elapsedDays(later: Date, earlier: Date): number {
  return Math.max(1, Math.round((later.getTime() - earlier.getTime()) / 86_400_000));
}

async function findBaseline(db: TenantTx, hotelId: string, target: Date) {
  const earliest = new Date(target.getTime() - 23 * HOUR_MS);
  return db.bookingPaceSnapshot.findFirst({
    where: { hotelId, observationAt: { gte: earliest, lte: target } },
    orderBy: { observationAt: "desc" },
  });
}

export const BookingPaceService = {
  async capture(withTenant: WithTenantFn, hotelId: string, now = new Date()) {
    const observationAt = floorHour(now);
    const startDate = getCurrentPKTDate(now);
    const endDate = addDays(startDate, SNAPSHOT_HORIZON_DAYS - 1);
    return withTenant(async (db) => {
      const metrics = await HotelMetricsService.getRangeFromDb(db, startDate, endDate);
      const payload: PaceSnapshotPayload = {
        version: 1,
        startDate,
        endDate,
        days: metrics.days,
        roomTypes: metrics.roomTypes,
      };
      return db.bookingPaceSnapshot.upsert({
        where: { hotelId_observationAt: { hotelId, observationAt } },
        create: { hotelId, observationAt, horizonDays: SNAPSHOT_HORIZON_DAYS, snapshot: payload as unknown as Prisma.InputJsonValue },
        update: { horizonDays: SNAPSHOT_HORIZON_DAYS, snapshot: payload as unknown as Prisma.InputJsonValue, capturedAt: now },
      });
    });
  },

  async getReport(withTenant: WithTenantFn, hotelId: string, startDate: string, days: number, lookbackDays: number) {
    const now = new Date();
    await this.capture(withTenant, hotelId, now);
    const endDate = addDays(startDate, days - 1);
    const observationAt = floorHour(now);
    const pickupTarget = new Date(observationAt.getTime() - lookbackDays * 86_400_000);
    const yearTarget = new Date(observationAt);
    yearTarget.setUTCFullYear(yearTarget.getUTCFullYear() - 1);

    return withTenant(async (db) => {
      const [currentRow, pickupRow, lastYearRow] = await Promise.all([
        db.bookingPaceSnapshot.findUnique({ where: { hotelId_observationAt: { hotelId, observationAt } } }),
        findBaseline(db, hotelId, pickupTarget),
        findBaseline(db, hotelId, yearTarget),
      ]);
      const currentPayload = readPayload(currentRow?.snapshot);
      if (!currentRow || !currentPayload) throw new Error("Current booking pace snapshot could not be read");
      const pickupPayload = readPayload(pickupRow?.snapshot);
      const lastYearPayload = readPayload(lastYearRow?.snapshot);
      const currentDays = currentPayload.days.filter((day) => day.date >= startDate && day.date <= endDate);
      const pickupDays = pickupPayload?.days.filter((day) => day.date >= startDate && day.date <= endDate) ?? [];
      const lastYearStart = shiftYear(startDate, -1);
      const lastYearEnd = shiftYear(endDate, -1);
      const lastYearDays = lastYearPayload?.days.filter((day) => day.date >= lastYearStart && day.date <= lastYearEnd) ?? [];
      const pickupByDate = new Map(pickupDays.map((day) => [day.date, day]));
      const lastYearByIndex = new Map(lastYearDays.map((day, index) => [index, day]));
      const pickupElapsed = pickupRow ? elapsedDays(currentRow.observationAt, pickupRow.observationAt) : null;

      const roomTypes = currentPayload.roomTypes.map((roomType) => {
        const current = roomType.days.filter((day) => day.date >= startDate && day.date <= endDate);
        const baselineRoomType = pickupPayload?.roomTypes.find((candidate) => candidate.id === roomType.id);
        const baseline = baselineRoomType?.days.filter((day) => day.date >= startDate && day.date <= endDate) ?? [];
        const currentSummary = summarize(current);
        const baselineSummary = baseline.length > 0 ? summarize(baseline) : null;
        return { id: roomType.id, name: roomType.name, current: currentSummary, pickup: diff(currentSummary, baselineSummary, pickupElapsed) };
      });

      const currentSummary = summarize(currentDays);
      const pickupSummary = pickupDays.length > 0 ? summarize(pickupDays) : null;
      const lastYearSummary = lastYearDays.length > 0 ? summarize(lastYearDays) : null;
      return {
        startDate,
        endDate,
        requestedLookbackDays: lookbackDays,
        current: { observationAt: currentRow.observationAt.toISOString(), summary: currentSummary },
        pickupBaseline: pickupRow && pickupPayload ? { observationAt: pickupRow.observationAt.toISOString(), elapsedDays: pickupElapsed, summary: pickupSummary } : null,
        lastYearBaseline: lastYearRow && lastYearPayload ? { observationAt: lastYearRow.observationAt.toISOString(), summary: lastYearSummary } : null,
        pickup: diff(currentSummary, pickupSummary, pickupElapsed),
        lastYearVariance: lastYearSummary ? {
          roomNights: currentSummary.roomsSold - lastYearSummary.roomsSold,
          revenue: currentSummary.expectedRoomRevenue - lastYearSummary.expectedRoomRevenue,
          occupancyPoints: Math.round((currentSummary.occupancyRate - lastYearSummary.occupancyRate) * 10) / 10,
        } : null,
        days: currentDays.map((day, index) => {
          const baseline = pickupByDate.get(day.date);
          const lastYear = lastYearByIndex.get(index);
          return {
            date: day.date,
            sellableRooms: day.sellableRooms,
            roomsSold: day.roomsSold,
            occupancyRate: day.occupancyRate,
            expectedRoomRevenue: day.expectedRoomRevenue,
            pickupRooms: baseline ? day.roomsSold - baseline.roomsSold : null,
            pickupRevenue: baseline ? day.expectedRoomRevenue - baseline.expectedRoomRevenue : null,
            lastYearRoomsSold: lastYear?.roomsSold ?? null,
          };
        }),
        roomTypes,
        collection: {
          startedAt: currentRow.observationAt.toISOString(),
          pickupAvailable: Boolean(pickupRow && pickupPayload && pickupSummary),
          lastYearAvailable: Boolean(lastYearRow && lastYearPayload && lastYearSummary),
        },
      };
    });
  },
};
