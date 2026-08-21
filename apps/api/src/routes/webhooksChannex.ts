/**
 * POST /api/webhooks/channex — inbound channel-manager events.
 *
 * Unauthenticated in the JWT sense; there is no user and no tenant context when
 * this fires. Three things stand in for that:
 *
 *   1. A shared secret in a header. Channex signs nothing — authentication is a
 *      value you set in the webhook's `headers` at registration time. Compared
 *      in constant time, and FAILS CLOSED: with no secret configured, every
 *      request is rejected rather than waved through.
 *   2. Tenant identity derived server-side from property_id, never from the
 *      request body. A caller cannot name the hotel it wants to write to.
 *   3. A rate limit, following the bookSubmitLimit precedent in bookingPublic.
 *
 * The handler does the minimum and returns 200 fast: Channex retries for 30
 * minutes and emails a warning if unacknowledged. Real work happens in the
 * ingestion worker, which PULLS authoritative data rather than trusting this
 * payload — deliveries can arrive out of order.
 */

import { Router } from "express";
import rateLimit from "express-rate-limit";
import { timingSafeEqual } from "node:crypto";
import { env } from "../lib/env";
import {
  resolveHotelByPropertyId,
  claimChannelEvent,
  enqueueBookingIngestion,
} from "../lib/channexIngestion";
import { unwrapAttributes } from "../lib/channexBookingMapper";

const router: Router = Router();

/** Header carrying the shared secret, configured on the Channex webhook. */
const SECRET_HEADER = "x-innflo-webhook-secret";

/** Events that mean "a booking changed" and need ingestion. */
const BOOKING_EVENTS = new Set(["booking_new", "booking_modification", "booking_cancellation", "booking"]);

const webhookLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 120, // generous: a busy property can legitimately burst
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip ?? "unknown",
  message: { error: "Too many webhook deliveries" },
});

/** Constant-time comparison — a length-safe wrapper around timingSafeEqual. */
function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

router.post("/", webhookLimit, async (req, res) => {
  // ── Authentication ─────────────────────────────────────────────────────────
  const expected = env.CHANNEX_WEBHOOK_SECRET;
  if (!expected) {
    // Fail closed. An unset secret means the integration is not configured, and
    // accepting writes in that state would be an unauthenticated write endpoint.
    console.error("❌ Channex webhook rejected: CHANNEX_WEBHOOK_SECRET is not configured");
    res.status(503).json({ error: "Webhook receiver is not configured" });
    return;
  }

  const provided = req.get(SECRET_HEADER) ?? "";
  if (!provided || !secretMatches(provided, expected)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // ── Payload triage ─────────────────────────────────────────────────────────
  const body = (req.body ?? {}) as Record<string, unknown>;
  const attributes = unwrapAttributes(body.payload ?? body) ?? {};

  const eventType = firstString(body.event, body.event_type, attributes.event, attributes.event_type) ?? "unknown";

  // Tenant identity comes from here and nowhere else. Never from a hotel id,
  // slug or header supplied by the caller.
  const propertyId = firstString(attributes.property_id, attributes.propertyId, body.property_id);
  if (!propertyId) {
    // 200, not 400: a malformed delivery will never become well-formed on
    // retry, and Channex escalates unacknowledged deliveries by email.
    console.error("❌ Channex webhook carried no property_id — acknowledged and dropped");
    res.status(200).json({ data: { received: true, ignored: "no property_id" } });
    return;
  }

  // RLS-bypassing lookup — see channexIngestion.resolveHotelByPropertyId.
  const hotelId = await resolveHotelByPropertyId(propertyId);
  if (!hotelId) {
    console.warn(`⚠️  Channex webhook for unknown or inactive property ${propertyId}`);
    res.status(200).json({ data: { received: true, ignored: "unknown property" } });
    return;
  }

  if (!BOOKING_EVENTS.has(eventType)) {
    // ARI acknowledgements and other notifications need no ingestion.
    res.status(200).json({ data: { received: true, ignored: `unhandled event ${eventType}` } });
    return;
  }

  const revisionId = firstString(
    attributes.revision_id, attributes.revisionId,
    attributes.booking_id, attributes.bookingId,
    attributes.id, body.revision_id,
  );
  if (!revisionId) {
    console.error(`❌ Channex webhook for property ${propertyId} carried no revision id`);
    res.status(200).json({ data: { received: true, ignored: "no revision id" } });
    return;
  }

  // ── Idempotency ────────────────────────────────────────────────────────────
  // The same claim the poller makes; whichever arrives second is dropped here.
  const claim = await claimChannelEvent({
    hotelId,
    sourceKey: revisionId,
    eventType,
    origin: "WEBHOOK",
    payload: body,
  });

  if (!claim.claimed) {
    res.status(200).json({ data: { received: true, duplicate: true } });
    return;
  }

  await enqueueBookingIngestion({
    hotelId,
    eventId: claim.eventId!,
    revisionId,
    eventType,
  });

  // ── Respond fast; the worker does the rest ─────────────────────────────────
  res.status(200).json({ data: { received: true } });
});

export default router;
