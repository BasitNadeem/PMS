import { Worker, type Job } from "bullmq";
import { redisConnectionOptions } from "../lib/redis";
import { sendEmail } from "../services/EmailService";
import { reservationLifecycleEmail } from "../lib/emailTemplates";
import type { ReservationEmailJobData } from "./queues";

function formatDateForEmail(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00Z`);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Karachi",
    weekday:  "short",
    day:      "numeric",
    month:    "short",
    year:     "numeric",
  }).format(date);
}

function subjectFor(data: ReservationEmailJobData): string {
  if (data.kind === "REQUEST_RECEIVED") {
    return `Booking request received — ${data.hotelName} (${data.confirmationNumber})`;
  }
  if (data.kind === "CANCELLED") {
    return `Reservation cancelled — ${data.hotelName} (${data.confirmationNumber})`;
  }
  return `Reservation confirmed — ${data.hotelName} (${data.confirmationNumber})`;
}

async function processReservationEmail(
  job: Job<ReservationEmailJobData>,
): Promise<{ success: boolean; messageId?: string }> {
  const data = job.data;
  console.log(`🔄 Sending ${data.kind.toLowerCase()} email to ${data.guestEmail} (${data.confirmationNumber})`);

  const htmlBody = reservationLifecycleEmail({
    ...data,
    checkInDate:  formatDateForEmail(data.checkInDate),
    checkOutDate: formatDateForEmail(data.checkOutDate),
  });

  const result = await sendEmail({
    to:       data.guestEmail,
    toName:   data.guestName,
    subject:  subjectFor(data),
    htmlBody,
  });

  if (!result.success) {
    // The reservation action already committed before this background job.
    throw new Error(result.error ?? "Reservation email send failed");
  }

  console.log(`✅ ${data.kind} email sent to ${data.guestEmail}`);
  return { success: true, messageId: result.messageId };
}

export const emailWorker = new Worker<ReservationEmailJobData, Record<string, unknown>, string>(
  "email",
  processReservationEmail,
  { connection: redisConnectionOptions, concurrency: 5 },
);

emailWorker.on("completed", (job) => {
  console.log(`✅ Email job ${job.id} completed`);
});

emailWorker.on("failed", (job, err) => {
  console.error(`❌ Email job ${job?.id} failed:`, err.message);
});
