import { Worker, type Job } from "bullmq";
import { adminPrisma, Prisma } from "@pms/db";
import { redisConnectionOptions } from "../lib/redis";
import { collectBriefingData } from "./collectBriefingData";
import { formatBriefingMessage, buildBriefingTemplateParams } from "./formatBriefingMessage";
import { sendBriefingTemplate } from "./sendWhatsappMessage";
import { getEffectiveLimits } from "../lib/subscription";
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

  // The repeatable job outlives a plan change: scheduleBriefings only re-reads
  // entitlement at boot, so without this a hotel downgraded (or whose trial
  // lapsed) mid-month keeps receiving briefings — and keeps billing us for the
  // conversations — until the API next restarts.
  //
  // Skipped rather than cancelled on purpose. Cancelling would leave a hotel
  // that re-upgrades with no job until the next restart, since nothing
  // reschedules on a plan change; a nightly no-op costs one query.
  const { features } = await getEffectiveLimits(hotelId);
  if (!features.whatsappBriefing) {
    console.log(`⚠️  WhatsApp briefing is not on ${hotelName}'s plan — skipping`);
    return { success: true, skipped: true, reason: "Feature not enabled on plan" };
  }

  const briefingData = await collectBriefingData(hotelId);
  const message      = formatBriefingMessage(briefingData);
  const params       = buildBriefingTemplateParams(briefingData);
  const result       = await sendBriefingTemplate(ownerWhatsappNumber, params, message);

  // STUB only when nothing left the process — a real send must never be logged as
  // STUB, or the log stops being usable evidence that a briefing was delivered.
  const status: LogStatus = !result.success ? "FAILED" : result.stubbed ? "STUB" : "SENT";

  await logBriefing(
    hotelId,
    ownerWhatsappNumber,
    message,
    status,
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
