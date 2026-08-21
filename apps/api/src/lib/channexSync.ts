/**
 * Enqueue layer for Channex ARI syncs — the counterpart to reservationEmails.ts.
 *
 * Called AFTER the database transaction commits, always inside a try/catch at
 * the call site. A channel-manager problem must never affect a booking response.
 *
 * Two properties matter here:
 *
 *   1. The payload carries identifiers and a date window only. Values are
 *      computed in the worker at push time, so a job that waited out the
 *      coalesce window publishes current truth, not stale truth.
 *
 *   2. Coalescing is per property. A burst of reservation activity at one hotel
 *      collapses into a single flush against that hotel's 10-requests-per-minute
 *      budget, and one busy hotel can never consume another hotel's.
 */

import { channexSyncQueue, type ChannexSyncJobData, type ChannexSyncReason } from "../jobs/queues";
import { env } from "./env";
import { addDays, toIsoDate } from "./channexRanges";

/**
 * How far ahead ARI is published. OTAs typically sell about a year out; beyond
 * the horizon a stay still syncs, because enqueue widens the window to cover it.
 */
export const CHANNEX_SYNC_HORIZON_DAYS = 365;

/**
 * One delayed job per hotel — the coalesce point.
 *
 * Hyphen separated, never ":". BullMQ v5 rejects a custom job id containing a
 * colon ("Custom Id cannot contain :"), and because every caller is a
 * fire-and-forget post-commit hook the rejection would be swallowed and every
 * sync would silently never run.
 */
export function channexSyncJobId(hotelId: string): string {
  return `channex-sync-${hotelId}`;
}

export interface EnqueueChannexSyncOptions {
  hotelId: string;
  reason: ChannexSyncReason;
  /** Widens the default horizon when a change falls outside it. */
  dateFrom?: string;
  dateTo?: string;
  /** Skips the coalesce delay — used by "Sync now" and post-provisioning. */
  immediate?: boolean;
}

function defaultWindow(): { dateFrom: string; dateTo: string } {
  const today = toIsoDate(new Date());
  return { dateFrom: today, dateTo: addDays(today, CHANNEX_SYNC_HORIZON_DAYS) };
}

/**
 * Queues a resync for one hotel, merging into any flush already pending.
 *
 * Returns false when nothing was queued. Never throws — callers are in
 * post-commit paths where a failure here must be logged and swallowed.
 */
export async function enqueueChannexSync(options: EnqueueChannexSyncOptions): Promise<boolean> {
  const { hotelId, reason } = options;
  if (!hotelId) return false;

  try {
    const base = defaultWindow();
    // A change outside the horizon (a booking 18 months out) widens the window
    // rather than being dropped.
    let dateFrom = options.dateFrom && options.dateFrom < base.dateFrom ? options.dateFrom : base.dateFrom;
    let dateTo   = options.dateTo   && options.dateTo   > base.dateTo   ? options.dateTo   : base.dateTo;

    const baseJobId = channexSyncJobId(hotelId);
    const existing = await channexSyncQueue.getJob(baseJobId);

    // True once the coalesce slot is free to reuse. It stays false when the
    // worker already holds a lock on the pending job, which is a real race:
    // getState() can report "waiting" a moment before the worker picks it up.
    let slotFree = true;

    if (existing) {
      const state = await existing.getState();
      if (state === "delayed" || state === "waiting") {
        // Union with the pending flush so coalescing can never narrow coverage.
        const pending = existing.data as ChannexSyncJobData;
        if (pending.dateFrom < dateFrom) dateFrom = pending.dateFrom;
        if (pending.dateTo   > dateTo)   dateTo   = pending.dateTo;
      }
      try {
        await existing.remove();
      } catch {
        // Locked by the worker — it is mid-push and cannot be replaced.
        slotFree = false;
      }
    }

    const data: ChannexSyncJobData = { hotelId, dateFrom, dateTo, reason };
    await channexSyncQueue.add(reason.toLowerCase().replace(/_/g, "-"), data, {
      // A push already in flight computed its values before this change landed,
      // so a follow-up flush is required rather than optional. Queue it under a
      // distinct id; pushes are idempotent, so the extra call is only ever
      // wasted work, never wrong data.
      jobId: slotFree ? baseJobId : `${baseJobId}-follow-${Date.now()}`,
      delay: options.immediate ? 0 : env.CHANNEX_SYNC_DEBOUNCE_MS,
    });
    return true;
  } catch (err) {
    console.error(`❌ Failed to enqueue Channex sync for hotel ${hotelId}:`, err);
    return false;
  }
}

/**
 * Fire-and-forget wrapper for the reservation and rate hook points.
 *
 * Every hook is a post-commit side effect on a user-facing request, so this
 * swallows everything by design — the pattern createLedgerEntryFromPayment and
 * enqueueReservationEmail already follow.
 */
export function queueChannexSync(options: EnqueueChannexSyncOptions): void {
  void enqueueChannexSync(options).catch((err) => {
    console.error(`❌ Channex sync enqueue failed for hotel ${options.hotelId}:`, err);
  });
}
