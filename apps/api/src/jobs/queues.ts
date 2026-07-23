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

export interface BookingConfirmationEmailJobData {
  guestEmail:          string;
  guestName:           string;
  hotelName:           string;
  hotelLogoUrl:        string | null;
  hotelAddress:        string | null;
  hotelPhone:          string | null;
  confirmationNumber:  string;
  checkInDate:         string;
  checkOutDate:        string;
  nights:              number;
  roomTypeName:        string;
  roomPhotoUrl:        string | null;
  adults:              number;
  children:            number;
  totalAmount:         number;
  specialRequests:     string | null;
}

export const emailQueue = new Queue<BookingConfirmationEmailJobData, Record<string, unknown>, string>("email", {
  connection: redisConnectionOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff:  { type: "exponential", delay: 5_000 },
    removeOnComplete: 100,
    removeOnFail:     50,
  },
});
