import { Worker, type Job } from "bullmq";
import { adminPrisma, Prisma } from "@pms/db";
import { redisConnectionOptions } from "../lib/redis";
import { collectBriefingData } from "./collectBriefingData";
import { formatBriefingMessage } from "./formatBriefingMessage";
import { sendWhatsappMessage } from "./sendWhatsappMessage";
import type { BriefingJobData } from "./queues";

type LogStatus = "SENT" | "FAILED" | "STUB";

async function logBriefing(
  hotelId:        string,
  recipientNumber: string,
  messageText:    string,
  status:         LogStatus,
  errorMessage?:  string,
  metaMessageId?: string,
): Promise<void> {
  await adminPrisma.$executeRaw`
    INSERT INTO whatsapp_briefing_logs
      (hotel_id, recipient_number, message_text, status, error_message, meta_message_id)
    VALUES
      (${hotelId}::uuid, ${recipientNumber}, ${messageText}, ${status}::text,
       ${errorMessage ?? null}, ${metaMessageId ?? null})
  `;
}

async function processBriefing(job: Job<BriefingJobData>): Promise<{ success: boolean; skipped?: boolean; reason?: string; messageId?: string }> {
  const { hotelId, hotelName } = job.data;
  console.log(`🔄 Processing briefing for hotel: ${hotelName} (${hotelId})`);

  const hotel = await adminPrisma.hotel.findFirst({
    where:  { id: hotelId },
    select: { settings: true, name: true },
  });

  const settings            = (hotel?.settings as Record<string, unknown>) ?? {};
  const ownerWhatsappNumber = settings.ownerWhatsappNumber as string | undefined;

  if (!ownerWhatsappNumber) {
    console.log(`⚠️  No WhatsApp number configured for hotel ${hotelName} — skipping`);
    return { success: true, skipped: true, reason: "No WhatsApp number configured" };
  }

  const briefingData = await collectBriefingData(hotelId);
  const message      = formatBriefingMessage(briefingData);
  const result       = await sendWhatsappMessage(ownerWhatsappNumber, message);

  await logBriefing(
    hotelId,
    ownerWhatsappNumber,
    message,
    result.success ? "STUB" : "FAILED",
    result.error,
    result.messageId,
  );

  if (!result.success) {
    throw new Error(result.error ?? "WhatsApp send failed");
  }

  console.log(`✅ Briefing sent for hotel: ${hotelName}`);
  return { success: true, messageId: result.messageId };
}

export const briefingWorker = new Worker<BriefingJobData, Record<string, unknown>, string>(
  "whatsapp-briefing",
  processBriefing,
  { connection: redisConnectionOptions, concurrency: 5 },
);

briefingWorker.on("completed", (job) => {
  console.log(`✅ Briefing job ${job.id} completed`);
});

briefingWorker.on("failed", (job, err) => {
  console.error(`❌ Briefing job ${job?.id} failed:`, err.message);
});
