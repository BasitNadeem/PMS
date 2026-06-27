import { adminPrisma } from "@pms/db";
import { briefingQueue, type BriefingJobData } from "./queues";

const BRIEFING_CRON = "0 18 * * *"; // 18:00 UTC = 23:00 PKT

export async function scheduleBriefings(): Promise<void> {
  console.log("📅 Setting up nightly briefing scheduler...");

  // Clear all existing repeatable jobs to prevent duplicates on restart
  const repeatableJobs = await briefingQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    await briefingQueue.removeRepeatableByKey(job.key);
  }

  const hotels = await adminPrisma.hotel.findMany({
    where:  { isActive: true },
    select: { id: true, name: true, settings: true },
  });

  let scheduled = 0;
  for (const hotel of hotels) {
    const settings   = (hotel.settings as Record<string, unknown>) ?? {};
    const hasNumber  = !!(settings.ownerWhatsappNumber);
    if (!hasNumber) continue;

    const jobData: BriefingJobData = { hotelId: hotel.id, hotelName: hotel.name };
    await briefingQueue.add(
      "nightly-briefing",
      jobData,
      { repeat: { pattern: BRIEFING_CRON }, jobId: `briefing-${hotel.id}` },
    );
    scheduled++;
    console.log(`  ✅ Scheduled briefing for: ${hotel.name}`);
  }

  console.log(`📅 Briefing scheduler ready — ${scheduled} hotel(s) scheduled`);
}

export async function scheduleHotelBriefing(hotelId: string, hotelName: string): Promise<void> {
  // Remove any existing repeatable job for this hotel
  const all = await briefingQueue.getRepeatableJobs();
  const existing = all.find((j) => j.id === `briefing-${hotelId}`);
  if (existing) {
    await briefingQueue.removeRepeatableByKey(existing.key);
  }

  const jobData: BriefingJobData = { hotelId, hotelName };
  await briefingQueue.add(
    "nightly-briefing",
    jobData,
    { repeat: { pattern: BRIEFING_CRON }, jobId: `briefing-${hotelId}` },
  );
  console.log(`✅ Briefing scheduled for hotel: ${hotelName}`);
}

export async function cancelHotelBriefing(hotelId: string): Promise<void> {
  const all = await briefingQueue.getRepeatableJobs();
  const existing = all.find((j) => j.id === `briefing-${hotelId}`);
  if (existing) {
    await briefingQueue.removeRepeatableByKey(existing.key);
    console.log(`🚫 Briefing cancelled for hotel: ${hotelId}`);
  }
}
