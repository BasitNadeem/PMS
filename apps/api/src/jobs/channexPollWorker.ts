/**
 * Polling fallback for missed webhook deliveries.
 *
 * A webhook can be lost to a deploy, a network blip, or a receiver that was
 * briefly down. This sweeps every active property for unacknowledged booking
 * revisions and feeds them through the SAME claim path the webhook uses, so a
 * booking that arrives both ways is still ingested exactly once — the loser of
 * the (hotel_id, provider, source_key) insert race is dropped.
 *
 * One repeatable job sweeps all properties rather than one job per hotel: the
 * feed call is cheap, and a single sweep keeps the schedule trivial to reason
 * about as the tenant base grows.
 */

import { Worker, type Job } from "bullmq";
import { adminPrisma } from "@pms/db";
import { redisConnectionOptions } from "../lib/redis";
import { channexPollQueue } from "./queues";
import { channexClient } from "../services/ChannexService";
import { claimChannelEvent, enqueueBookingIngestion } from "../lib/channexIngestion";
import { unwrapAttributes } from "../lib/channexBookingMapper";

const CHANNEL_TYPE = "CHANNEL_MANAGER" as const;

/** Comfortably inside Channex's 30-minute retry-then-warn window. */
export const CHANNEX_POLL_CRON = "*/15 * * * *";

export interface PollOutcome {
  [key: string]: unknown;
  propertiesPolled: number;
  revisionsFound: number;
  revisionsClaimed: number;
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

async function processPoll(_job: Job): Promise<PollOutcome> {
  const configs = await adminPrisma.channelConfig.findMany({
    where:  { channelType: CHANNEL_TYPE, isActive: true },
    select: { hotelId: true, credentials: true },
  });

  let propertiesPolled = 0;
  let revisionsFound = 0;
  let revisionsClaimed = 0;

  for (const config of configs) {
    const credentials = (config.credentials ?? {}) as Record<string, unknown>;
    const propertyId = typeof credentials.channex_property_id === "string" ? credentials.channex_property_id : null;
    if (!propertyId) continue;

    const client = channexClient({
      apiKey: typeof credentials.api_key === "string" ? credentials.api_key : undefined,
      hotelId: config.hotelId,
    });

    const feed = await client.listBookingRevisions(propertyId);
    if (!feed.success) {
      // One property failing must not abort the sweep for the others.
      console.error(`❌ Channex poll failed for hotel ${config.hotelId}: ${feed.error}`);
      continue;
    }
    propertiesPolled += 1;

    const revisions = Array.isArray(feed.data) ? feed.data : [];
    for (const revision of revisions) {
      const attributes = unwrapAttributes(revision) ?? {};
      const revisionId = firstString(
        (revision as Record<string, unknown>).id,
        attributes.revision_id, attributes.revisionId,
        attributes.booking_id, attributes.id,
      );
      if (!revisionId) continue;
      revisionsFound += 1;

      const eventType = firstString(attributes.status, attributes.event, attributes.revision_type) ?? "booking";

      // Identical claim to the webhook's — this is what makes the two paths
      // converge on exactly-once instead of racing.
      const claim = await claimChannelEvent({
        hotelId: config.hotelId,
        sourceKey: revisionId,
        eventType,
        origin: "POLL",
        payload: revision,
      });
      if (!claim.claimed) continue; // the webhook already got it

      revisionsClaimed += 1;
      await enqueueBookingIngestion({
        hotelId: config.hotelId,
        eventId: claim.eventId!,
        revisionId,
        eventType,
      });
    }
  }

  if (revisionsClaimed > 0) {
    console.log(
      `📥 Channex poll: ${revisionsClaimed} revision(s) recovered that no webhook delivered ` +
      `(${revisionsFound} seen across ${propertiesPolled} propert${propertiesPolled === 1 ? "y" : "ies"})`,
    );
  }

  return { propertiesPolled, revisionsFound, revisionsClaimed };
}

export const channexPollWorker = new Worker<Record<string, never>, Record<string, unknown>, string>(
  "channex-poll",
  processPoll,
  { connection: redisConnectionOptions, concurrency: 1 },
);

channexPollWorker.on("failed", (job, err) => {
  console.error(`❌ Channex poll job ${job?.id} failed:`, err.message);
});

/** Registers the sweep. Safe to call on every boot. */
export async function scheduleChannexPolling(): Promise<void> {
  const repeatables = await channexPollQueue.getRepeatableJobs();
  for (const job of repeatables) {
    await channexPollQueue.removeRepeatableByKey(job.key);
  }
  await channexPollQueue.add("poll-booking-revisions", {}, {
    repeat: { pattern: CHANNEX_POLL_CRON },
    jobId:  "channex-poll-sweep",
  });
  console.log(`📅 Channex booking poll scheduled (${CHANNEX_POLL_CRON})`);
}
