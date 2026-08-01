import { adminPrisma } from "@pms/db";
import { occasionQueue, type OccasionSweepJobData } from "./queues";

// 03:00 UTC = 08:00 PKT — the greeting lands before the guest's day starts,
// and well clear of the 18:00 UTC nightly briefing.
const OCCASION_CRON = "0 3 * * *";

/**
 * Schedules one daily occasion sweep per active hotel.
 *
 * Mirrors the briefing scheduler: repeatable jobs are cleared first so a
 * restart cannot accumulate duplicates, which would mean a guest receiving the
 * same birthday email several times.
 */
export async function scheduleOccasionSweeps(): Promise<void> {
  console.log("🎂 Setting up daily occasion scheduler...");

  const existing = await occasionQueue.getRepeatableJobs();
  for (const job of existing) {
    await occasionQueue.removeRepeatableByKey(job.key);
  }

  const hotels = await adminPrisma.hotel.findMany({
    where:  { isActive: true },
    select: { id: true, name: true },
  });

  let scheduled = 0;
  for (const hotel of hotels) {
    const jobData: OccasionSweepJobData = { hotelId: hotel.id, hotelName: hotel.name };
    await occasionQueue.add(
      "occasion-sweep",
      jobData,
      { repeat: { pattern: OCCASION_CRON }, jobId: `occasions-${hotel.id}` },
    );
    scheduled++;
  }

  console.log(`🎂 Occasion scheduler ready — ${scheduled} hotel(s) scheduled`);
}
