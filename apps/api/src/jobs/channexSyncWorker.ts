/**
 * Channex ARI sync worker.
 *
 * Recomputes availability and rates from current state, collapses them into
 * contiguous ranges, and pushes each in ONE batched call per property.
 *
 * Rate limits are per property (10 availability + 10 restriction requests per
 * minute), so the throttle here is per property too: a 429 pauses that hotel
 * for 60 seconds without touching anyone else's budget.
 */

import { Worker, type Job } from "bullmq";
import { adminPrisma } from "@pms/db";
import { redisConnectionOptions, redis } from "../lib/redis";
import { channexSyncQueue, type ChannexSyncJobData } from "./queues";
import { channexSyncJobId } from "../lib/channexSync";
import { channexClient, type ChannexAvailabilityValue, type ChannexRestrictionValue } from "../services/ChannexService";
import { paisasToChannexRate } from "../utils/channexMoney";
import { collapseRanges, eachDate, type DatedValue } from "../lib/channexRanges";
import {
  computeAvailability,
  NON_OCCUPYING_RESERVATION_STATUSES,
  UNSELLABLE_ROOM_STATUSES,
  type OccupancySpan,
} from "../lib/channexOccupancy";
import {
  buildRateSeries, rateSeriesPointsEqual, type ResolvableRatePlan, type RateSeriesPoint,
} from "../lib/channexRates";
import { evaluateOtaEligibility } from "../lib/channexEligibility";

const CHANNEL_TYPE = "CHANNEL_MANAGER" as const;

/** Channex guidance: on any error, pause that property for one minute. */
const RATE_LIMIT_PAUSE_SECONDS = 60;

function pauseKey(hotelId: string): string {
  return `channex:pause:${hotelId}`;
}

/** Per property, never global — one busy hotel must not starve another. */
async function isPaused(hotelId: string): Promise<number> {
  try {
    const ttl = await redis.ttl(pauseKey(hotelId));
    return ttl > 0 ? ttl : 0;
  } catch {
    return 0; // Redis trouble must not block a sync outright
  }
}

async function pauseProperty(hotelId: string): Promise<void> {
  try {
    await redis.set(pauseKey(hotelId), "1", "EX", RATE_LIMIT_PAUSE_SECONDS);
  } catch (err) {
    console.error(`❌ Could not set Channex pause for hotel ${hotelId}:`, err);
  }
}

async function recordSyncResult(
  hotelId: string,
  status: string,
  error: string | null,
): Promise<void> {
  await adminPrisma.channelConfig.updateMany({
    where: { hotelId, channelType: CHANNEL_TYPE },
    data:  { lastSyncAt: new Date(), lastSyncStatus: status, lastSyncError: error },
  });
}

export interface ChannexSyncOutcome {
  /** BullMQ types a job's return value as Record<string, unknown>. */
  [key: string]: unknown;
  skipped?: string;
  pausedSeconds?: number;
  availabilityRows?: number;
  restrictionRows?: number;
  warnings?: string[];
}

async function processChannexSync(job: Job<ChannexSyncJobData>): Promise<ChannexSyncOutcome> {
  const { hotelId, dateFrom, dateTo, reason } = job.data;

  // ── 1. Config gate ─────────────────────────────────────────────────────────
  const config = await adminPrisma.channelConfig.findUnique({
    where: { hotelId_channelType: { hotelId, channelType: CHANNEL_TYPE } },
  });
  if (!config || !config.isActive) {
    return { skipped: "channel manager not active for this hotel" };
  }

  const credentials = (config.credentials ?? {}) as Record<string, unknown>;
  const propertyId = typeof credentials.channex_property_id === "string" ? credentials.channex_property_id : null;
  if (!propertyId) {
    return { skipped: "hotel is not provisioned on Channex" };
  }

  // ── 9. Per-property throttle ───────────────────────────────────────────────
  const pausedFor = await isPaused(hotelId);
  if (pausedFor > 0) {
    // Re-queue behind the pause instead of burning a retry attempt.
    await channexSyncQueue.add(job.name, job.data, {
      jobId: channexSyncJobId(hotelId),
      delay: (pausedFor + 1) * 1_000,
    }).catch(() => { /* a pending job already covers this hotel */ });
    return { pausedSeconds: pausedFor };
  }

  const dates = eachDate(dateFrom, dateTo);
  if (dates.length === 0) return { skipped: "empty date window" };

  const client = channexClient({
    apiKey: typeof credentials.api_key === "string" ? credentials.api_key : undefined,
    hotelId,
  });

  const warnings: string[] = [];
  let availabilityRows = 0;
  let restrictionRows = 0;

  // ── 2/3. Availability, when sync_inventory is on ───────────────────────────
  if (config.syncInventory) {
    const roomTypes = await adminPrisma.roomType.findMany({
      where:  { hotelId, isActive: true, channexRoomTypeId: { not: null } },
      select: { id: true, channexRoomTypeId: true },
    });

    if (roomTypes.length > 0) {
      const roomTypeIds = roomTypes.map((rt) => rt.id);

      // Two queries for the whole window — the per-date work is in memory.
      const horizonEnd = new Date(`${dates[dates.length - 1]}T00:00:00.000Z`);
      horizonEnd.setUTCDate(horizonEnd.getUTCDate() + 1);

      const [rooms, spans, blocks] = await Promise.all([
        adminPrisma.room.groupBy({
          by:    ["roomTypeId"],
          where: {
            hotelId, isActive: true,
            roomTypeId: { in: roomTypeIds },
            status: { notIn: [...UNSELLABLE_ROOM_STATUSES] },
          },
          _count: { _all: true },
        }),
        adminPrisma.reservationRoom.findMany({
          where: {
            roomTypeId:   { in: roomTypeIds },
            checkInDate:  { lt: horizonEnd },
            checkOutDate: { gt: new Date(`${dates[0]}T00:00:00.000Z`) },
            reservation: {
              hotelId,
              status: { notIn: [...NON_OCCUPYING_RESERVATION_STATUSES] },
            },
          },
          select: { roomTypeId: true, checkInDate: true, checkOutDate: true },
        }),
        adminPrisma.roomInventoryBlock.findMany({
          where: {
            hotelId,
            cancelledAt: null,
            startDate: { lt: horizonEnd },
            endDate: { gt: new Date(`${dates[0]}T00:00:00.000Z`) },
            room: { roomTypeId: { in: roomTypeIds }, isActive: true },
          },
          select: { startDate: true, endDate: true, room: { select: { roomTypeId: true } } },
        }),
      ]);

      const roomCountsByType = new Map<string, number>(roomTypeIds.map((id) => [id, 0]));
      for (const row of rooms) roomCountsByType.set(row.roomTypeId, row._count._all);

      const availability = computeAvailability({
        dates,
        roomCountsByType,
        spans: spans as OccupancySpan[],
        blocks: blocks.map((block) => ({
          roomTypeId: block.room.roomTypeId,
          startDate: block.startDate,
          endDate: block.endDate,
        })),
      });

      // ── 5/6. Collapse, then batch EVERY room type into one call ────────────
      const values: ChannexAvailabilityValue[] = [];
      for (const roomType of roomTypes) {
        const byDate = availability.get(roomType.id);
        if (!byDate) continue;
        const series: DatedValue<number>[] = dates.map((date) => ({ date, value: byDate.get(date) ?? 0 }));
        for (const range of collapseRanges(series)) {
          values.push({
            property_id:  propertyId,
            room_type_id: roomType.channexRoomTypeId!,
            date_from:    range.date_from,
            date_to:      range.date_to,
            availability: range.value,
          });
        }
      }

      if (values.length > 0) {
        const res = await client.pushAvailability(values);
        if (res.rateLimited) {
          await pauseProperty(hotelId);
          await recordSyncResult(hotelId, "RATE_LIMITED", res.error ?? "rate limited");
          throw new Error(`Channex rate limited availability push for hotel ${hotelId}`);
        }
        if (!res.success) {
          await recordSyncResult(hotelId, "FAILED", res.error ?? "availability push failed");
          throw new Error(res.error ?? "Channex availability push failed");
        }
        // ── 7. A 200 is not success — warnings mean partial rejection ────────
        if (res.warnings?.length) warnings.push(...res.warnings);
        availabilityRows = values.length;
      }
    }
  }

  // ── 2/4. Rates, when sync_rates is on ──────────────────────────────────────
  if (config.syncRates) {
    // Only provisioned pairs are ever pushed — filtered on the item, not the
    // plan, because a plan maps to one Channex rate plan per room type.
    const plans = await adminPrisma.ratePlan.findMany({
      where: {
        hotelId,
        items: { some: { channexRatePlanId: { not: null } } },
      },
      select: {
        id: true, name: true, type: true, isActive: true, codeRequired: true,
        companyId: true, validFrom: true, validTo: true, daysOfWeek: true, minLos: true,
        items: { select: { roomTypeId: true, rate: true, channexRatePlanId: true } },
      },
    });

    const values: ChannexRestrictionValue[] = [];

    for (const plan of plans) {
      // Re-checked at push time, not just at provisioning: a plan that becomes
      // company-linked or code-required after being provisioned must stop
      // being distributed immediately.
      const eligibility = evaluateOtaEligibility({
        isActive:     plan.isActive,
        codeRequired: plan.codeRequired,
        companyId:    plan.companyId,
        type:         plan.type,
        roomTypeIds:  plan.items.map((i) => i.roomTypeId),
      });

      const resolvable: ResolvableRatePlan = {
        id: plan.id,
        isActive: plan.isActive,
        validFrom: plan.validFrom,
        validTo: plan.validTo,
        daysOfWeek: plan.daysOfWeek,
        minLos: plan.minLos,
        ratesByRoomTypeId: new Map(plan.items.map((i) => [i.roomTypeId, i.rate])),
      };

      for (const item of plan.items) {
        if (!item.channexRatePlanId) continue;

        // An ineligible plan is closed everywhere rather than left live.
        const series: DatedValue<RateSeriesPoint>[] = eligibility.eligible
          ? buildRateSeries(resolvable, item.roomTypeId, dates)
          : dates.map((date) => ({ date, value: { rate: null, stopSell: true } }));

        for (const range of collapseRanges(series, rateSeriesPointsEqual)) {
          values.push({
            property_id:  propertyId,
            rate_plan_id: item.channexRatePlanId,
            date_from:    range.date_from,
            date_to:      range.date_to,
            // Money crosses the boundary only through the shared utility.
            ...(range.value.rate !== null && { rate: paisasToChannexRate(range.value.rate) }),
            stop_sell:    range.value.stopSell,
          });
        }
      }
    }

    // ── 6. Every rate plan in ONE call ─────────────────────────────────────
    if (values.length > 0) {
      const res = await client.pushRestrictions(values);
      if (res.rateLimited) {
        await pauseProperty(hotelId);
        await recordSyncResult(hotelId, "RATE_LIMITED", res.error ?? "rate limited");
        throw new Error(`Channex rate limited restrictions push for hotel ${hotelId}`);
      }
      if (!res.success) {
        await recordSyncResult(hotelId, "FAILED", res.error ?? "restrictions push failed");
        throw new Error(res.error ?? "Channex restrictions push failed");
      }
      if (res.warnings?.length) warnings.push(...res.warnings);
      restrictionRows = values.length;
    }
  }

  // ── 8. Record the outcome ──────────────────────────────────────────────────
  await recordSyncResult(
    hotelId,
    warnings.length > 0 ? "PARTIAL" : "OK",
    warnings.length > 0 ? warnings.join("; ").slice(0, 2_000) : null,
  );

  console.log(
    `✅ Channex sync (${reason}) hotel ${hotelId}: ` +
    `${availabilityRows} availability range(s), ${restrictionRows} restriction range(s)` +
    (warnings.length > 0 ? `, ${warnings.length} warning(s)` : ""),
  );

  return { availabilityRows, restrictionRows, ...(warnings.length > 0 && { warnings }) };
}

export const channexSyncWorker = new Worker<ChannexSyncJobData, Record<string, unknown>, string>(
  "channex-sync",
  processChannexSync,
  {
    connection: redisConnectionOptions,
    // Several hotels sync concurrently; one job per hotel at a time is already
    // guaranteed by the per-hotel jobId used at enqueue.
    concurrency: 3,
  },
);

channexSyncWorker.on("failed", (job, err) => {
  console.error(`❌ Channex sync job ${job?.id} failed:`, err.message);
});
