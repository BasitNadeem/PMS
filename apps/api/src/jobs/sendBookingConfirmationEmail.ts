import { Worker, type Job } from "bullmq";
import { redisConnectionOptions } from "../lib/redis";
import { sendEmail } from "../services/EmailService";
import { bookingConfirmationEmail } from "../lib/emailTemplates";
import type { BookingConfirmationEmailJobData } from "./queues";

// Date-only strings ("YYYY-MM-DD") have no time component, so parsing as UTC
// midnight and formatting in Asia/Karachi (+5) only ever moves the displayed
// time forward — it can never roll the calendar day backward.
function formatDateForEmail(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00Z`);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Karachi",
    weekday:  "long",
    day:      "numeric",
    month:    "long",
    year:     "numeric",
  }).format(date);
}

async function processBookingConfirmationEmail(
  job: Job<BookingConfirmationEmailJobData>,
): Promise<{ success: boolean; messageId?: string }> {
  const data = job.data;
  console.log(`🔄 Sending booking confirmation email to ${data.guestEmail} (${data.confirmationNumber})`);

  const htmlBody = bookingConfirmationEmail({
    hotelName:          data.hotelName,
    hotelLogoUrl:       data.hotelLogoUrl,
    hotelAddress:       data.hotelAddress,
    hotelPhone:         data.hotelPhone,
    guestName:          data.guestName,
    confirmationNumber: data.confirmationNumber,
    checkInDate:        formatDateForEmail(data.checkInDate),
    checkOutDate:       formatDateForEmail(data.checkOutDate),
    nights:             data.nights,
    roomTypeName:       data.roomTypeName,
    roomPhotoUrl:       data.roomPhotoUrl,
    adults:             data.adults,
    children:           data.children,
    totalAmount:        data.totalAmount,
    specialRequests:    data.specialRequests,
  });

  const result = await sendEmail({
    to:       data.guestEmail,
    toName:   data.guestName,
    subject:  `Booking Confirmed — ${data.hotelName} (${data.confirmationNumber})`,
    htmlBody,
  });

  if (!result.success) {
    // Never affects the booking itself — it was already created before this job runs.
    throw new Error(result.error ?? "Booking confirmation email send failed");
  }

  console.log(`✅ Booking confirmation email sent to ${data.guestEmail}`);
  return { success: true, messageId: result.messageId };
}

export const emailWorker = new Worker<BookingConfirmationEmailJobData, Record<string, unknown>, string>(
  "email",
  processBookingConfirmationEmail,
  { connection: redisConnectionOptions, concurrency: 5 },
);

emailWorker.on("completed", (job) => {
  console.log(`✅ Email job ${job.id} completed`);
});

emailWorker.on("failed", (job, err) => {
  console.error(`❌ Email job ${job?.id} failed:`, err.message);
});
