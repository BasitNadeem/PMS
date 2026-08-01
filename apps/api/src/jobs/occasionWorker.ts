import { Worker, type Job } from "bullmq";
import { adminPrisma, PromoIssueReason, SpecialDateKind } from "@pms/db";
import { redisConnectionOptions } from "../lib/redis";
import { enqueuePromoCodeEmail } from "../lib/promoEmails";
import { acquireSubscriptionQuotaLock, checkSubscriptionLimit } from "../lib/subscription";
import { getCurrentPKTDate } from "../lib/timezone";
import { occurrenceNumber, isLeapDayObservedOn } from "../utils/occasions";
import type { OccasionSweepJobData } from "./queues";

// How many days before the occasion the code goes out, and how long the guest
// then has to use it. Sending a few days early gives someone time to actually
// plan a stay around it.
const DEFAULT_LEAD_DAYS  = 3;
const DEFAULT_VALID_DAYS = 45;
const DEFAULT_DISCOUNT_PERCENT = 10;

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

const REASON_FOR_KIND: Record<SpecialDateKind, PromoIssueReason> = {
  BIRTHDAY:    PromoIssueReason.BIRTHDAY,
  ANNIVERSARY: PromoIssueReason.ANNIVERSARY,
  CUSTOM:      PromoIssueReason.MANUAL,
};

function randomCode(prefix: string): string {
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return `${prefix}-${suffix}`;
}

/**
 * Finds guests whose birthday or anniversary falls `LEAD_DAYS` from now, issues
 * each one a personal single-use code, and emails it.
 *
 * Hotels explicitly enable birthday/anniversary offers in tenant settings.
 */
async function processOccasionSweep(job: Job<OccasionSweepJobData>): Promise<Record<string, unknown>> {
  const { hotelId, hotelName } = job.data;

  const hotel = await adminPrisma.hotel.findUnique({
    where:  { id: hotelId },
    select: { settings: true },
  });
  const settings = (hotel?.settings ?? {}) as Record<string, unknown>;
  const birthdayEnabled = settings.birthdayOffersEnabled === true;
  const anniversaryEnabled = settings.anniversaryOffersEnabled === true;
  if (!birthdayEnabled && !anniversaryEnabled) return { skipped: "occasion offers disabled" };

  const discountPercent = typeof settings.occasionOfferDiscountPercent === "number"
    ? settings.occasionOfferDiscountPercent : DEFAULT_DISCOUNT_PERCENT;
  const leadDays = typeof settings.occasionOfferLeadDays === "number"
    ? settings.occasionOfferLeadDays : DEFAULT_LEAD_DAYS;
  const validDays = typeof settings.occasionOfferValidityDays === "number"
    ? settings.occasionOfferValidityDays : DEFAULT_VALID_DAYS;
  const kinds = [
    ...(birthdayEnabled ? [SpecialDateKind.BIRTHDAY] : []),
    ...(anniversaryEnabled ? [SpecialDateKind.ANNIVERSARY] : []),
  ];

  const today = new Date(`${getCurrentPKTDate()}T00:00:00.000Z`);
  const target = new Date(today);
  target.setUTCDate(target.getUTCDate() + leadDays);
  const month = target.getUTCMonth() + 1;
  const day   = target.getUTCDate();

  const dates = await adminPrisma.guestSpecialDate.findMany({
    where: {
      hotelId,
      kind: { in: kinds },
      OR: [
        { month, day },
        // A 29 February occasion is observed on the 28th in non-leap years,
        // otherwise those guests are skipped three years out of four.
        ...(isLeapDayObservedOn(target, 2, 29) ? [{ month: 2, day: 29 }] : []),
      ],
      guest: { deletedAt: null, isBlacklisted: false, marketingOptIn: true, email: { not: null } },
    },
    include: { guest: { select: { id: true, fullName: true } } },
  });

  const validTo = new Date(today);
  validTo.setUTCDate(validTo.getUTCDate() + validDays);

  let issued = 0;
  let skipped = 0;

  for (const date of dates) {
    // One offer per guest per occasion per year. Without this guard a retried
    // job — or a scheduler that fired twice — would issue duplicate codes.
    const alreadyIssued = await adminPrisma.ratePlanCode.findFirst({
      where: {
        hotelId,
        guestId:     date.guestId,
        issueReason: REASON_FOR_KIND[date.kind],
        createdAt:   { gte: new Date(Date.now() - 300 * 86_400_000) },
      },
      select: { id: true },
    });
    if (alreadyIssued) { skipped++; continue; }

    const created = await adminPrisma.$transaction(async (db) => {
      await acquireSubscriptionQuotaLock(db, hotelId, "maxActivePromoCodes");
      const activeCount = await db.ratePlanCode.count({
        where: {
          hotelId,
          isActive: true,
          AND: [
            { OR: [{ validTo: null }, { validTo: { gte: today } }] },
            { OR: [{ maxUses: null }, { usedCount: 0 }] },
          ],
        },
      });
      await checkSubscriptionLimit(hotelId, "maxActivePromoCodes", activeCount);

      for (let attempt = 0; attempt < 5; attempt++) {
        const code = randomCode(date.kind === SpecialDateKind.BIRTHDAY ? "BD" : "AN");
        const clash = await db.ratePlanCode.findFirst({ where: { hotelId, code }, select: { id: true } });
        if (clash) continue;
        return db.ratePlanCode.create({
          data: {
            hotelId,
            guestId:     date.guestId,
            code,
            label:       date.kind === SpecialDateKind.BIRTHDAY ? "Birthday offer" : "Anniversary offer",
            issueReason: REASON_FOR_KIND[date.kind],
            discountPercent,
            maxUses:     1,
            validFrom:   today,
            validTo,
            isActive:    true,
          },
        });
      }
      return null;
    });
    if (!created) { skipped++; continue; }

    const occurrence = occurrenceNumber(date.year, target);
    try {
      await enqueuePromoCodeEmail({
        codeId:    created.id,
        hotelId,
        guestId:   date.guestId,
        code:      created.code,
        offerName: `${discountPercent}% off your next stay`,
        discountPercent,
        validTo,
        reason:    date.kind === SpecialDateKind.BIRTHDAY ? "BIRTHDAY" : "ANNIVERSARY",
        // Only stated when the guest gave us the year — we never guess a number.
        occasionLabel: occurrence ? `${occurrence}` : null,
      });
    } catch (error) {
      console.error(`Failed to queue occasion email for guest ${date.guestId}:`, error);
      await adminPrisma.ratePlanCode.update({
        where: { id: created.id },
        data: { emailStatus: "FAILED", emailError: "Could not queue email" },
      });
    }

    await adminPrisma.auditLog.create({
      data: {
        hotelId,
        userId:   null,
        action:   "GUEST_PROMO_CODE_ISSUED",
        entity:   "guest",
        entityId: date.guestId,
        after:    { code: created.code, reason: REASON_FOR_KIND[date.kind], automated: true },
      },
    });

    issued++;
  }

  console.log(`🎂 ${hotelName}: ${issued} occasion code(s) issued, ${skipped} skipped`);
  return { issued, skipped, candidates: dates.length };
}

export const occasionWorker = new Worker<OccasionSweepJobData, Record<string, unknown>, string>(
  "occasions",
  processOccasionSweep,
  { connection: redisConnectionOptions, concurrency: 2 },
);

occasionWorker.on("failed", (job, err) => {
  console.error(`❌ Occasion sweep ${job?.id} failed:`, err.message);
});
