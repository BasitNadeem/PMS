/**
 * The single ingestion path for inbound channel-manager bookings.
 *
 * Both the webhook endpoint and the polling fallback funnel through
 * `claimChannelEvent`, so a booking that arrives twice — once pushed, once
 * pulled — is processed exactly once. The guarantee is the database's, not the
 * application's: a unique index on (hotel_id, provider, source_key) means the
 * second caller loses the insert race and is told so.
 *
 * Tenant resolution is the awkward part and is handled here deliberately.
 * A webhook arrives with a Channex property_id and nothing else — no JWT, no
 * subdomain, no tenant context. `channel_configs` has RLS enabled, so the
 * property_id → hotel_id lookup cannot run under a tenant transaction; it must
 * go through adminPrisma, which bypasses RLS. The resolved hotelId is what then
 * establishes tenant context for everything downstream.
 */

import { adminPrisma, Prisma } from "@pms/db";
import { channexBookingQueue, type ChannexBookingJobData } from "../jobs/queues";

export const CHANNEX_PROVIDER = "CHANNEX" as const;
const CHANNEL_TYPE = "CHANNEL_MANAGER" as const;

/**
 * property_id → hotel_id.
 *
 * adminPrisma by necessity: this runs before any tenant context exists, and
 * channel_configs is RLS-protected. The JSONB lookup is served by
 * idx_channel_configs_channex_property (see rls_and_triggers.sql section 10).
 *
 * Only active configs resolve — a disconnected hotel silently stops accepting
 * inbound bookings rather than half-processing them.
 */
export async function resolveHotelByPropertyId(propertyId: string): Promise<string | null> {
  if (!propertyId) return null;
  const rows = await adminPrisma.$queryRaw<Array<{ hotel_id: string }>>`
    SELECT hotel_id
    FROM channel_configs
    WHERE channel_type = ${CHANNEL_TYPE}::"ChannelType"
      AND is_active = true
      AND credentials ->> 'channex_property_id' = ${propertyId}
    LIMIT 1
  `;
  return rows[0]?.hotel_id ?? null;
}

export interface ChannelEventClaim {
  hotelId: string;
  sourceKey: string;
  eventType: string;
  origin: "WEBHOOK" | "POLL";
  payload: unknown;
  provider?: string;
}

export interface ClaimResult {
  /** False when this event was already recorded — do not process it again. */
  claimed: boolean;
  eventId: string | null;
}

/**
 * Records an inbound event, or reports that someone already did.
 *
 * The unique constraint is the arbiter, not a prior SELECT: a check-then-insert
 * would leave a window in which a webhook and a poll both pass the check.
 */
export async function claimChannelEvent(claim: ChannelEventClaim): Promise<ClaimResult> {
  const provider = claim.provider ?? CHANNEX_PROVIDER;
  try {
    const event = await adminPrisma.channelWebhookEvent.create({
      data: {
        hotelId:   claim.hotelId,
        provider,
        sourceKey: claim.sourceKey,
        eventType: claim.eventType,
        origin:    claim.origin,
        // Stored for debugging only — ingestion re-pulls authoritative data.
        payload:   (claim.payload ?? {}) as Prisma.InputJsonValue,
      },
      select: { id: true },
    });
    return { claimed: true, eventId: event.id };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const existing = await adminPrisma.channelWebhookEvent.findUnique({
        where: {
          hotelId_provider_sourceKey: { hotelId: claim.hotelId, provider, sourceKey: claim.sourceKey },
        },
        select: { id: true },
      });
      return { claimed: false, eventId: existing?.id ?? null };
    }
    throw err;
  }
}

export async function markEventProcessed(eventId: string): Promise<void> {
  await adminPrisma.channelWebhookEvent.update({
    where: { id: eventId },
    data:  { status: "PROCESSED", processedAt: new Date(), error: null },
  });
}

export async function markEventFailed(eventId: string, error: string): Promise<void> {
  await adminPrisma.channelWebhookEvent.update({
    where: { id: eventId },
    data:  { status: "FAILED", error: error.slice(0, 2_000), attempts: { increment: 1 } },
  });
}

/**
 * Hands a claimed event to the ingestion worker.
 *
 * The job carries identifiers only. The authoritative booking is pulled inside
 * the worker, because Channex delivery can arrive out of order and using the
 * delivered payload as data causes stale writes.
 */
export async function enqueueBookingIngestion(data: ChannexBookingJobData): Promise<void> {
  await channexBookingQueue.add("ingest-booking", data, {
    // One job per event row; a retry or duplicate enqueue collapses onto it.
    jobId: `channex-booking-${data.eventId}`,
  });
}
