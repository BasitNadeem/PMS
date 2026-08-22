import { Queue } from "bullmq";
import { redisConnectionOptions } from "../lib/redis";

export interface BriefingJobData {
  hotelId:   string;
  hotelName: string;
}

// Third generic = string (job name type) to avoid BullMQ v5 name-literal narrowing
export const briefingQueue = new Queue<BriefingJobData, Record<string, unknown>, string>("whatsapp-briefing", {
  connection: redisConnectionOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff:  { type: "exponential", delay: 5_000 },
    removeOnComplete: 100,
    removeOnFail:     50,
  },
});

export type ReservationEmailKind = "REQUEST_RECEIVED" | "CONFIRMED" | "CANCELLED";

export interface ReservationEmailRoom {
  name:        string;
  description: string | null;
  quantity:    number;
  amount:      number;
  photoUrls:   string[];
  amenities:   string[];
}

export interface ReservationEmailJobData {
  kind:                ReservationEmailKind;
  guestEmail:          string;
  guestName:           string;
  hotelName:           string;
  hotelLogoUrl:        string | null;
  hotelAddress:        string | null;
  hotelCity:           string | null;
  hotelPhone:          string | null;
  hotelWhatsapp:       string | null;
  hotelEmail:          string | null;
  hotelWebsite:        string | null;
  hotelAmenities:      string[];
  accentColor:         string;
  confirmationNumber:  string;
  checkInDate:         string;
  checkOutDate:        string;
  nights:              number;
  rooms:               ReservationEmailRoom[];
  adults:              number;
  children:            number;
  totalAmount:         number;
  specialRequests:     string | null;
  promoCode:           string | null;
  cancellationPolicy:  string | null;
  bookingPaymentTerms: string | null;
}

export interface OccasionSweepJobData {
  hotelId:   string;
  hotelName: string;
}

export interface BookingPaceJobData {
  hotelId: string;
  hotelName: string;
}

export const bookingPaceQueue = new Queue<BookingPaceJobData, Record<string, unknown>, string>("booking-pace-snapshots", {
  connection: redisConnectionOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5_000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

export const occasionQueue = new Queue<OccasionSweepJobData, Record<string, unknown>, string>("occasions", {
  connection: redisConnectionOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff:  { type: "exponential", delay: 5_000 },
    removeOnComplete: 100,
    removeOnFail:     50,
  },
});

export type PromoEmailReason = "BIRTHDAY" | "ANNIVERSARY" | "VIP_REWARD" | "WIN_BACK" | "MANUAL";

export interface PromoEmailJobData {
  hotelId:      string;
  codeId:       string;
  guestEmail:   string;
  guestName:    string;
  /** Used in the body — "Hamza" reads like a person, "HAMZA YOLO" reads like a database row. */
  guestFirstName: string;
  /** Completed stays. Only ever used to say something true; 0 or 1 says nothing. */
  stayCount:    number;
  hotelName:    string;
  hotelLogoUrl: string | null;
  hotelAddress: string | null;
  hotelCity:    string | null;
  hotelCountry: string | null;
  hotelPhone:   string | null;
  hotelEmail:   string | null;
  hotelWebsite: string | null;
  accentColor:  string;
  /** Darker partner to accentColor, for bands that carry white text. */
  reason:       PromoEmailReason;
  /** "birthday" / "5th anniversary" — already humanised for the subject line. */
  occasionLabel: string | null;
  code:         string;
  offerName:    string;
  discountPercent: number;
  /** ISO date; the deadline is what makes the offer act. */
  validTo:      string;
}

export const promoEmailQueue = new Queue<PromoEmailJobData, Record<string, unknown>, string>("promo-email", {
  connection: redisConnectionOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff:  { type: "exponential", delay: 5_000 },
    removeOnComplete: 100,
    removeOnFail:     50,
  },
});

export const emailQueue = new Queue<ReservationEmailJobData, Record<string, unknown>, string>("email", {
  connection: redisConnectionOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff:  { type: "exponential", delay: 5_000 },
    removeOnComplete: 100,
    removeOnFail:     50,
  },
});

/** Why a hotel's ARI is being resynced. Diagnostic only — never changes the push. */
export type ChannexSyncReason =
  | "RESERVATION"
  | "RESERVATION_STATUS"
  | "RESERVATION_EDIT"
  | "BOOKING_ENGINE"
  | "ROOM_TYPE_CHANGE"
  | "ROOM_INVENTORY_BLOCK_CHANGE"
  | "RATE_PLAN_CHANGE"
  | "PROVISION"
  | "NIGHTLY"
  | "MANUAL";

/**
 * Identifiers and a window only — never precomputed availability or rates.
 * The worker recomputes from current state at push time, so a job delayed by
 * the coalesce window (or a retry) publishes current truth rather than
 * whatever was true when it was queued.
 */
export interface ChannexSyncJobData {
  hotelId:  string;
  /** Inclusive ISO YYYY-MM-DD. */
  dateFrom: string;
  /** Inclusive ISO YYYY-MM-DD. */
  dateTo:   string;
  reason:   ChannexSyncReason;
}

/**
 * Identifiers only. The authoritative booking is pulled inside the worker —
 * webhook delivery can arrive out of order, so the delivered payload is a
 * trigger, never data.
 */
export interface ChannexBookingJobData {
  hotelId: string;
  /** channel_webhook_events row this job is settling. */
  eventId: string;
  /** Channex booking-revision id to pull and acknowledge. */
  revisionId: string;
  eventType: string;
}

export const channexBookingQueue = new Queue<ChannexBookingJobData, Record<string, unknown>, string>("channex-booking", {
  connection: redisConnectionOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff:  { type: "exponential", delay: 5_000 },
    removeOnComplete: 100,
    removeOnFail:     50,
  },
});

export const channexSyncQueue = new Queue<ChannexSyncJobData, Record<string, unknown>, string>("channex-sync", {
  connection: redisConnectionOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff:  { type: "exponential", delay: 5_000 },
    removeOnComplete: 100,
    removeOnFail:     50,
  },
});

/** Repeatable sweep that recovers booking revisions no webhook delivered. */
export const channexPollQueue = new Queue<Record<string, never>, Record<string, unknown>, string>("channex-poll", {
  connection: redisConnectionOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff:  { type: "exponential", delay: 5_000 },
    removeOnComplete: 20,
    removeOnFail:     20,
  },
});
