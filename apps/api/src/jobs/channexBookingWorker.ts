/**
 * Inbound booking ingestion.
 *
 * The webhook and the poller both stop at "an event exists"; everything that
 * writes to Innflo happens here, once, for a claimed event.
 *
 * Order matters and is deliberate:
 *   1. PULL the authoritative revision from Channex. The webhook payload is a
 *      trigger only — deliveries can arrive out of order, so writing delivered
 *      values would let an older revision overwrite a newer one.
 *   2. Write the reservation inside one tenant transaction.
 *   3. ACKNOWLEDGE to Channex, so it stops retrying.
 *   4. Resync availability, since the booking just consumed inventory.
 */

import { Worker, type Job } from "bullmq";
import { adminPrisma, Prisma } from "@pms/db";
import type { TenantTx } from "@pms/db";
import { redisConnectionOptions } from "../lib/redis";
import type { ChannexBookingJobData } from "./queues";
import { channexClient } from "../services/ChannexService";
import { publicWithTenant } from "../lib/publicTenant";
import { markEventProcessed, markEventFailed } from "../lib/channexIngestion";
import { parseBookingRevision, type ParsedBooking } from "../lib/channexBookingMapper";
import { queueChannexSync } from "../lib/channexSync";
import { NON_OCCUPYING_RESERVATION_STATUSES, UNSELLABLE_ROOM_STATUSES } from "../lib/channexOccupancy";
import { NotificationService } from "../services/NotificationService";

const CHANNEL_TYPE = "CHANNEL_MANAGER" as const;

/**
 * Marks an ingestion failure as an overbooking rather than a generic error.
 *
 * Overbooking is the most operationally serious state this integration can
 * reach: a guest holds a confirmed booking for a room the property does not
 * have. It is classified distinctly so the Settings panel can surface it apart
 * from ordinary failures, and so it raises an in-app alert for staff who can
 * actually move a guest or open inventory.
 */
export const OVERBOOKING_PREFIX = "OVERBOOKING: ";

function toDate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

/**
 * Finds a physical room of the requested type that is free for the stay.
 *
 * Mirrors the picker in routes/bookingPublic.ts, with one deliberate
 * difference: rooms in an unsellable status are excluded here. An OTA booking
 * against a blocked room has to be honoured — nobody at the desk gets a chance
 * to intervene the way they would on an internal booking.
 */
async function findFreeRoom(
  db: TenantTx,
  roomTypeId: string,
  checkIn: Date,
  checkOut: Date,
): Promise<string | null> {
  const rooms = await db.room.findMany({
    where: {
      roomTypeId,
      isActive: true,
      status: { notIn: [...UNSELLABLE_ROOM_STATUSES] },
    },
    select: { id: true },
  });
  if (rooms.length === 0) return null;

  const booked = await db.reservationRoom.findMany({
    where: {
      roomId:       { in: rooms.map((r) => r.id) },
      checkInDate:  { lt: checkOut },
      checkOutDate: { gt: checkIn },
      reservation:  { status: { notIn: [...NON_OCCUPYING_RESERVATION_STATUSES] } },
    },
    select: { roomId: true },
  });

  const takenIds = new Set(booked.map((r) => r.roomId));
  return rooms.find((room) => !takenIds.has(room.id))?.id ?? null;
}

async function upsertOtaGuest(db: TenantTx, hotelId: string, booking: ParsedBooking): Promise<string> {
  // Phone first, then email — the same precedence the booking engine uses, so
  // an OTA guest merges with their direct-booking profile rather than forking.
  let guest = booking.guestPhone
    ? await db.guest.findFirst({ where: { phone: booking.guestPhone }, select: { id: true } })
    : null;
  if (!guest && booking.guestEmail) {
    guest = await db.guest.findFirst({ where: { email: booking.guestEmail }, select: { id: true } });
  }
  if (guest) return guest.id;

  const parts = booking.guestName.trim().split(/\s+/);
  const created = await db.guest.create({
    data: {
      hotelId,
      firstName: parts[0] ?? "OTA",
      // Empty rather than repeated: a DB trigger builds full_name by joining
      // these, so duplicating a single-word name yields "Name Name".
      lastName:  parts.length > 1 ? parts.slice(1).join(" ") : "",
      fullName:  booking.guestName.trim(),
      phone:     booking.guestPhone,
      email:     booking.guestEmail,
    },
    select: { id: true },
  });
  return created.id;
}

export interface BookingIngestOutcome {
  [key: string]: unknown;
  action: "CREATED" | "MODIFIED" | "CANCELLED" | "IGNORED";
  reservationId?: string;
  reason?: string;
}

async function processBookingIngestion(job: Job<ChannexBookingJobData>): Promise<BookingIngestOutcome> {
  const { hotelId, eventId, revisionId } = job.data;

  const config = await adminPrisma.channelConfig.findUnique({
    where: { hotelId_channelType: { hotelId, channelType: CHANNEL_TYPE } },
  });
  const credentials = (config?.credentials ?? {}) as Record<string, unknown>;
  const client = channexClient({
    apiKey: typeof credentials.api_key === "string" ? credentials.api_key : undefined,
    hotelId,
  });

  // ── 1. Pull authoritative state ────────────────────────────────────────────
  const pulled = await client.getBooking(revisionId);
  if (!pulled.success) {
    await markEventFailed(eventId, pulled.error ?? "Failed to pull booking revision");
    throw new Error(pulled.error ?? "Failed to pull booking revision from Channex");
  }

  const parsed = parseBookingRevision(pulled.data);
  if (!parsed.ok) {
    // Unparseable will not become parseable on retry — record and stop.
    await markEventFailed(eventId, parsed.error);
    return { action: "IGNORED", reason: parsed.error };
  }
  const booking = parsed.booking;
  const withTenant = publicWithTenant(hotelId);

  // ── 2. Write ───────────────────────────────────────────────────────────────
  let outcome: BookingIngestOutcome;
  try {
    outcome = await withTenant(async (db) => {
      const existing = await db.reservation.findFirst({
        where:  { hotelId, otaBookingRef: booking.bookingId },
        select: { id: true, status: true, checkInDate: true, checkOutDate: true },
      });

      // ── Cancellation ─────────────────────────────────────────────────────
      if (booking.status === "CANCELLED") {
        if (!existing) return { action: "IGNORED", reason: "cancellation for an unknown booking" };
        if (existing.status === "CANCELLED") return { action: "IGNORED", reason: "already cancelled" };

        await db.reservation.update({
          where: { id: existing.id },
          data:  {
            status: "CANCELLED",
            cancelledAt: new Date(),
            cancellationReason: `Cancelled via ${booking.otaName ?? "channel manager"}`,
          },
        });
        await db.auditLog.create({
          data: {
            hotelId, userId: null,
            action: "RESERVATION_CANCELLED",
            entity: "reservation", entityId: existing.id,
            after: JSON.parse(JSON.stringify({ source: "CHANNEX", otaBookingRef: booking.bookingId })),
          },
        });
        return { action: "CANCELLED", reservationId: existing.id };
      }

      const room = booking.rooms[0];
      const checkIn  = toDate(booking.checkInDate);
      const checkOut = toDate(booking.checkOutDate);

      const roomType = await db.roomType.findFirst({
        where:  { hotelId, channexRoomTypeId: room.channexRoomTypeId },
        select: { id: true, name: true },
      });
      if (!roomType) {
        throw new Error(`No local room type mapped to Channex room type ${room.channexRoomTypeId}`);
      }

      const roomTypeName = roomType.name;
      const nights = Math.max(1, Math.round((checkOut.getTime() - checkIn.getTime()) / 86_400_000));
      // Trust the OTA's money, not a local recomputation: the guest has already
      // been quoted and often charged by the channel.
      const totalAmount  = booking.totalAmount || room.amount;
      const ratePerNight = Math.round((room.amount || totalAmount) / nights);

      // ── Modification ───────────────────────────────────────────────────────
      if (existing) {
        const freeRoomId = await findFreeRoom(db, roomType.id, checkIn, checkOut);
        await db.reservation.update({
          where: { id: existing.id },
          data: {
            checkInDate: checkIn, checkOutDate: checkOut,
            adults: room.adults, children: room.children, infants: room.infants,
            quotedRate: ratePerNight, totalAmount, balanceDue: totalAmount,
            status: "CONFIRMED",
            otaSource: booking.otaName,
            ...(freeRoomId && {
              rooms: {
                updateMany: {
                  where: {},
                  data: {
                    roomId: freeRoomId, roomTypeId: roomType.id,
                    ratePerNight, checkInDate: checkIn, checkOutDate: checkOut,
                  },
                },
              },
            }),
          },
        });
        await db.auditLog.create({
          data: {
            hotelId, userId: null,
            action: "RESERVATION_UPDATE",
            entity: "reservation", entityId: existing.id,
            after: JSON.parse(JSON.stringify({ source: "CHANNEX", otaBookingRef: booking.bookingId })),
          },
        });
        return { action: "MODIFIED", reservationId: existing.id };
      }

      // ── New booking ────────────────────────────────────────────────────────
      const freeRoomId = await findFreeRoom(db, roomType.id, checkIn, checkOut);
      if (!freeRoomId) {
        // Overbooking: the OTA sold a room we no longer have, and the guest is
        // already holding a confirmation. This cannot be silently dropped — the
        // prefix is what routes it to an operator alert in the outer catch.
        throw new Error(
          `${OVERBOOKING_PREFIX}${booking.otaName ?? "A channel"} sold a ${roomTypeName} for ` +
          `${booking.checkInDate} to ${booking.checkOutDate} (${booking.bookingId}) but no room of that type is free.`,
        );
      }

      const guestId = await upsertOtaGuest(db, hotelId, booking);
      const created = await db.reservation.create({
        data: {
          hotelId, guestId,
          // Empty string is valid: a DB trigger overwrites it with the
          // generated confirmation number.
          confirmationNumber: "",
          status: "CONFIRMED",
          source: booking.bookingSource as Prisma.ReservationCreateInput["source"],
          otaBookingRef: booking.bookingId,
          otaSource:     booking.otaName,
          checkInDate: checkIn, checkOutDate: checkOut,
          adults: room.adults, children: room.children, infants: room.infants,
          quotedRate: ratePerNight,
          totalAmount, balanceDue: totalAmount,
          specialRequests: booking.notes,
          rooms: {
            create: {
              roomId: freeRoomId, roomTypeId: roomType.id,
              ratePerNight, checkInDate: checkIn, checkOutDate: checkOut,
            },
          },
        },
        select: { id: true },
      });

      await db.auditLog.create({
        data: {
          hotelId, userId: null,
          action: "RESERVATION_CREATE",
          entity: "reservation", entityId: created.id,
          after: JSON.parse(JSON.stringify({
            source: "CHANNEX", ota: booking.otaName, otaBookingRef: booking.bookingId,
          })),
        },
      });
      return { action: "CREATED", reservationId: created.id };
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Booking ingestion failed";
    await markEventFailed(eventId, message);

    if (message.startsWith(OVERBOOKING_PREFIX)) {
      // Fired here, not inside the transaction above — that transaction rolled
      // back, so a notification written inside it would have vanished with it.
      try {
        await NotificationService.createNotificationsForRoles(
          hotelId,
          ["OWNER", "MANAGER", "FRONT_DESK"],
          {
            type:  "OVERBOOKING",
            title: "⚠️ Overbooking — channel sold an unavailable room",
            body:  message.slice(OVERBOOKING_PREFIX.length),
            entityType: "reservation",
          },
        );
      } catch (notifyErr) {
        console.error("❌ Failed to raise overbooking notification:", notifyErr);
      }
    }
    throw err;
  }

  // ── 3. Acknowledge — stops Channex retrying for 30 minutes ─────────────────
  const acked = await client.acknowledgeBooking(revisionId);
  if (!acked.success) {
    // The reservation is saved; a failed ack only risks redelivery, which the
    // idempotency claim absorbs. Log it rather than failing the job.
    console.error(`⚠️  Channex ack failed for revision ${revisionId}: ${acked.error}`);
  }

  await markEventProcessed(eventId);

  // ── 4. The booking moved inventory — republish. ────────────────────────────
  if (outcome.action !== "IGNORED") {
    queueChannexSync({
      hotelId,
      reason: "RESERVATION",
      ...(booking.checkInDate && booking.checkOutDate
        ? { dateFrom: booking.checkInDate, dateTo: booking.checkOutDate }
        : {}),
    });
  }

  console.log(`✅ Channex booking ${booking.bookingId} ${outcome.action.toLowerCase()} for hotel ${hotelId}`);
  return outcome;
}

export const channexBookingWorker = new Worker<ChannexBookingJobData, Record<string, unknown>, string>(
  "channex-booking",
  processBookingIngestion,
  { connection: redisConnectionOptions, concurrency: 3 },
);

channexBookingWorker.on("failed", (job, err) => {
  console.error(`❌ Channex booking ingestion ${job?.id} failed:`, err.message);
});
