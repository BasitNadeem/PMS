/**
 * Nightly full ARI resync, one repeatable job per hotel.
 *
 * Incremental syncs are triggered by events; this is the safety net that heals
 * anything a missed event or a failed push left stale. Channex permits a full
 * sync roughly once per 24h and asks for off-peak, so hotels are staggered a
 * few minutes apart rather than all firing on the same minute.
 *
 * Follows jobs/briefingScheduler.ts: repeatables are cleared on boot to avoid
 * duplicates across restarts, and schedule/cancel helpers let the Settings
 * toggle enable or disable a single hotel without a redeploy.
 */

import { adminPrisma } from "@pms/db";
import { channexSyncQueue, type ChannexSyncJobData } from "./queues";
import { addDays, toIsoDate } from "../lib/channexRanges";
import { CHANNEX_SYNC_HORIZON_DAYS } from "../lib/channexSync";

const CHANNEL_TYPE = "CHANNEL_MANAGER" as const;

/** 02:00 UTC = 07:00 PKT — after the night audit, before the day picks up. */
const BASE_HOUR_UTC = 2;

/** Spread hotels across the hour so a large tenant base does not spike. */
const STAGGER_MINUTES = 3;
const MAX_STAGGER_SLOTS = 20; // wraps after an hour's worth of slots

function cronFor(index: number): string {
  const slot = index % MAX_STAGGER_SLOTS;
  return `${slot * STAGGER_MINUTES} ${BASE_HOUR_UTC} * * *`;
}

function repeatJobId(hotelId: string): string {
  return `channex-nightly-${hotelId}`;
}

function windowForToday(): { dateFrom: string; dateTo: string } {
  const today = toIsoDate(new Date());
  return { dateFrom: today, dateTo: addDays(today, CHANNEX_SYNC_HORIZON_DAYS) };
}

async function removeRepeatable(hotelId: string): Promise<void> {
  const existing = await channexSyncQueue.getRepeatableJobs();
  const match = existing.find((job) => job.id === repeatJobId(hotelId));
  if (match) await channexSyncQueue.removeRepeatableByKey(match.key);
}

/**
 * Registers a nightly sync for every hotel with an active, provisioned Channex
 * connection. Safe to call on every boot.
 */
export async function scheduleChannexSyncs(): Promise<void> {
  console.log("📅 Setting up nightly Channex ARI sync scheduler...");

  // Clear first so a hotel that disconnected does not keep a stale repeatable.
  const repeatableJobs = await channexSyncQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    await channexSyncQueue.removeRepeatableByKey(job.key);
  }

  const configs = await adminPrisma.channelConfig.findMany({
    where:  { channelType: CHANNEL_TYPE, isActive: true },
    select: { hotelId: true, credentials: true },
  });

  let scheduled = 0;
  for (const [index, config] of configs.entries()) {
    const credentials = (config.credentials ?? {}) as Record<string, unknown>;
    if (typeof credentials.channex_property_id !== "string") continue; // not provisioned

    const { dateFrom, dateTo } = windowForToday();
    const data: ChannexSyncJobData = { hotelId: config.hotelId, dateFrom, dateTo, reason: "NIGHTLY" };

    await channexSyncQueue.add("nightly-full-sync", data, {
      repeat: { pattern: cronFor(index) },
      jobId:  repeatJobId(config.hotelId),
    });
    scheduled += 1;
  }

  console.log(`📅 Channex sync scheduler ready — ${scheduled} hotel(s) scheduled`);
}

/** Called when a hotel activates its Channex connection from Settings. */
export async function scheduleHotelChannexSync(hotelId: string): Promise<void> {
  await removeRepeatable(hotelId);

  // Stagger by a stable hash of the id so a hotel keeps its slot across boots.
  const slot = [...hotelId].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const { dateFrom, dateTo } = windowForToday();
  const data: ChannexSyncJobData = { hotelId, dateFrom, dateTo, reason: "NIGHTLY" };

  await channexSyncQueue.add("nightly-full-sync", data, {
    repeat: { pattern: cronFor(slot) },
    jobId:  repeatJobId(hotelId),
  });
  console.log(`✅ Nightly Channex sync scheduled for hotel ${hotelId}`);
}

/** Called when a hotel deactivates its Channex connection. */
export async function cancelHotelChannexSync(hotelId: string): Promise<void> {
  await removeRepeatable(hotelId);
  console.log(`🚫 Nightly Channex sync cancelled for hotel ${hotelId}`);
}
