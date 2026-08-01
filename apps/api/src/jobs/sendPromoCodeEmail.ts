import { Worker, type Job } from "bullmq";
import { adminPrisma } from "@pms/db";
import { redisConnectionOptions } from "../lib/redis";
import { sendEmail } from "../services/EmailService";
import { promoCodeEmail } from "../lib/emailTemplates";
import type { PromoEmailJobData } from "./queues";

function subjectFor(data: PromoEmailJobData): string {
  switch (data.reason) {
    case "BIRTHDAY":
      return `Happy birthday, ${data.guestName.split(" ")[0]} — a gift from ${data.hotelName}`;
    case "ANNIVERSARY":
      return `Happy anniversary — a gift from ${data.hotelName}`;
    case "VIP_REWARD":
      return `A thank you from ${data.hotelName}`;
    case "WIN_BACK":
      return `We miss you at ${data.hotelName}`;
    default:
      return `An offer for you from ${data.hotelName}`;
  }
}

async function processPromoEmail(job: Job<PromoEmailJobData>): Promise<{ success: boolean; messageId?: string }> {
  const data = job.data;
  console.log(`🔄 Sending ${data.reason.toLowerCase()} promo email to ${data.guestEmail} (${data.code})`);

  const result = await sendEmail({
    to:       data.guestEmail,
    toName:   data.guestName,
    subject:  subjectFor(data),
    htmlBody: promoCodeEmail(data),
  });

  if (!result.success) {
    // The code was already issued and is valid regardless of delivery, so a
    // failure here retries the email rather than revoking the offer.
    const error = result.error ?? "Promo code email send failed";
    await adminPrisma.ratePlanCode.updateMany({
      where: { id: data.codeId, hotelId: data.hotelId },
      data: { emailStatus: "FAILED", emailError: error },
    });
    throw new Error(error);
  }

  await adminPrisma.ratePlanCode.updateMany({
    where: { id: data.codeId, hotelId: data.hotelId },
    data: { emailStatus: "SENT", emailSentAt: new Date(), emailError: null },
  });

  console.log(`✅ ${data.reason} promo email sent to ${data.guestEmail}`);
  return { success: true, messageId: result.messageId };
}

export const promoEmailWorker = new Worker<PromoEmailJobData, Record<string, unknown>, string>(
  "promo-email",
  processPromoEmail,
  { connection: redisConnectionOptions, concurrency: 5 },
);

promoEmailWorker.on("failed", (job, err) => {
  console.error(`❌ Promo email job ${job?.id} failed:`, err.message);
});
