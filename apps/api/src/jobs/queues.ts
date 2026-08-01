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
  hotelName:    string;
  hotelLogoUrl: string | null;
  hotelPhone:   string | null;
  hotelEmail:   string | null;
  hotelWebsite: string | null;
  accentColor:  string;
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
