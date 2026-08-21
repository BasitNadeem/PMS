import { adminPrisma } from "@pms/db";
import { bookingPaceQueue, type BookingPaceJobData } from "./queues";

const BOOKING_PACE_CRON = "8 * * * *";

export async function scheduleBookingPaceSnapshots(): Promise<void> {
  console.log("📈 Setting up hourly booking pace snapshots...");
  const existing = await bookingPaceQueue.getRepeatableJobs();
  for (const job of existing) await bookingPaceQueue.removeRepeatableByKey(job.key);

  const hotels = await adminPrisma.hotel.findMany({ where: { isActive: true }, select: { id: true, name: true } });
  for (const hotel of hotels) {
    const data: BookingPaceJobData = { hotelId: hotel.id, hotelName: hotel.name };
    await bookingPaceQueue.add("capture-booking-pace", data, {
      repeat: { pattern: BOOKING_PACE_CRON },
      jobId: `booking-pace-${hotel.id}`,
    });
  }
  console.log(`📈 Booking pace scheduler ready — ${hotels.length} hotel(s) scheduled`);
}
