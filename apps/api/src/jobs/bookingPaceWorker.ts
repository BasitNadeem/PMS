import { Worker, type Job } from "bullmq";
import { publicWithTenant } from "../lib/publicTenant";
import { redisConnectionOptions } from "../lib/redis";
import { BookingPaceService } from "../services/BookingPaceService";
import type { BookingPaceJobData } from "./queues";

async function capture(job: Job<BookingPaceJobData>): Promise<Record<string, unknown>> {
  const { hotelId, hotelName } = job.data;
  const snapshot = await BookingPaceService.capture(publicWithTenant(hotelId), hotelId);
  console.log(`📈 ${hotelName}: booking pace snapshot captured for ${snapshot.observationAt.toISOString()}`);
  return { hotelId, observationAt: snapshot.observationAt.toISOString() };
}

export const bookingPaceWorker = new Worker<BookingPaceJobData, Record<string, unknown>, string>(
  "booking-pace-snapshots",
  capture,
  { connection: redisConnectionOptions, concurrency: 2 },
);

bookingPaceWorker.on("failed", (job, error) => {
  console.error(`❌ Booking pace snapshot ${job?.id} failed:`, error.message);
});
