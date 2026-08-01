import type { TenantTx } from "@pms/db";
import type { JwtPayload } from "../middleware/auth";
import { PromoIssueReason, SpecialDateKind } from "@pms/db";
import { AppError } from "../utils/AppError";
import { notifyHotelDataChanged } from "../lib/realtime";
import { upcomingWindow, isLeapDayObservedOn, occurrenceNumber, formatMonthDay } from "../utils/occasions";
import { enqueuePromoCodeEmail } from "../lib/promoEmails";
import { acquireSubscriptionQuotaLock, checkSubscriptionLimit } from "../lib/subscription";
import { getCurrentPKTDate } from "../lib/timezone";
import type { SpecialDateDto, ListOccasionsQuery, IssuePromoCodeDto } from "../schemas/guests";

type WithTenantFn = <T>(fn: (db: TenantTx) => Promise<T>) => Promise<T>;

// Ambiguous characters (0/O, 1/I/L) are excluded so a code read aloud over the
// phone or copied off a screenshot does not get mistyped.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

const REASON_PREFIX: Record<PromoIssueReason, string> = {
  BIRTHDAY:    "BD",
  ANNIVERSARY: "AN",
  VIP_REWARD:  "VIP",
  WIN_BACK:    "WB",
  MANUAL:      "PR",
};

function randomCode(reason: PromoIssueReason): string {
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return `${REASON_PREFIX[reason]}-${suffix}`;
}

export const GuestOccasionService = {
  /**
   * Replaces a guest's special dates wholesale.
   *
   * Called from the guest update path, where the client sends the full list.
   * Replacing rather than merging keeps the API honest about deletions — there
   * is no separate "remove this date" call to forget to make.
   */
  async replaceSpecialDates(db: TenantTx, hotelId: string, guestId: string, dates: SpecialDateDto[]) {
    await db.guestSpecialDate.deleteMany({ where: { guestId } });
    if (dates.length === 0) return;

    // The unique index is (guestId, kind, month, day); de-duplicate first so a
    // client sending the same occasion twice gets a clean save, not a 409.
    const seen = new Set<string>();
    const rows = dates.filter((d) => {
      const key = `${d.kind}-${d.month}-${d.day}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    await db.guestSpecialDate.createMany({
      data: rows.map((d) => ({
        hotelId,
        guestId,
        kind:   d.kind,
        label:  d.label ?? null,
        month:  d.month,
        day:    d.day,
        year:   d.year ?? null,
        source: d.source ?? "FRONT_DESK",
      })),
    });
  },

  /**
   * Records a birthday derived from a captured date of birth, but only when the
   * guest has none.
   *
   * Additive rather than a replace: this runs on ordinary profile edits, and
   * wiping an anniversary the guest volunteered because someone corrected a
   * phone number would be a nasty surprise. An existing birthday is left alone
   * so a hand-corrected greeting date survives.
   */
  async addBirthdayIfMissing(db: TenantTx, hotelId: string, guestId: string, dateOfBirth: string) {
    const dob = new Date(dateOfBirth);
    if (Number.isNaN(dob.getTime())) return;

    const existing = await db.guestSpecialDate.findFirst({
      where:  { guestId, kind: SpecialDateKind.BIRTHDAY },
      select: { id: true },
    });
    if (existing) return;

    await db.guestSpecialDate.create({
      data: {
        hotelId,
        guestId,
        kind:   SpecialDateKind.BIRTHDAY,
        month:  dob.getUTCMonth() + 1,
        day:    dob.getUTCDate(),
        year:   dob.getUTCFullYear(),
        source: "DOCUMENT",
      },
    });
  },

  /**
   * Guests with a birthday or anniversary in the next `withinDays`.
   *
   * Reports coverage alongside the results: on a fresh database most guests
   * have no date on file, and "12 birthdays this week" read without knowing it
   * is drawn from 8% of guests is a misleading number to plan around.
   */
  async listUpcoming(withTenant: WithTenantFn, query: ListOccasionsQuery) {
    const today  = new Date(`${getCurrentPKTDate()}T00:00:00.000Z`);
    const window = upcomingWindow(today, query.withinDays);

    const { rows, guestsTotal, guestsWithDates } = await withTenant(async (db) => ({
      rows: await db.guestSpecialDate.findMany({
        where: {
          OR: window.map((w) => ({ month: w.month, day: w.day })),
          guest: { deletedAt: null, isBlacklisted: false },
        },
        include: {
          guest: {
            select: {
              id: true, fullName: true, email: true, phone: true,
              vipLevel: true, marketingOptIn: true, totalStays: true,
            },
          },
        },
      }),
      guestsTotal:     await db.guest.count({ where: { deletedAt: null } }),
      guestsWithDates: await db.guest.count({ where: { deletedAt: null, specialDates: { some: {} } } }),
    }));

    const items = rows
      .map((row) => {
        const match = window.find((w) => w.month === row.month && w.day === row.day);
        // A 29 February occasion is observed on the 28th in non-leap years,
        // otherwise those guests are skipped three years in four.
        const leapEntry = window.find((w) => isLeapDayObservedOn(
          new Date(today.getTime() + w.inDays * 86_400_000), row.month, row.day,
        ));
        const inDays = match?.inDays ?? leapEntry?.inDays;
        if (inDays === undefined) return null;

        const on = new Date(today.getTime() + inDays * 86_400_000);
        return {
          id:         row.id,
          kind:       row.kind,
          label:      row.label,
          date:       formatMonthDay(row.month, row.day),
          month:      row.month,
          day:        row.day,
          inDays,
          /** Null when the guest withheld the year — the greeting omits it. */
          occurrence: occurrenceNumber(row.year, on),
          observedOnLeapFallback: Boolean(!match && leapEntry),
          guest:      row.guest,
        };
      })
      .filter((v): v is NonNullable<typeof v> => v !== null)
      .sort((a, b) => a.inDays - b.inDays || a.guest.fullName.localeCompare(b.guest.fullName));

    return {
      data: items,
      meta: {
        withinDays: query.withinDays,
        // Coverage, so the number above is never read as a whole-database truth.
        guestsTotal,
        guestsWithDates,
        coveragePercent: guestsTotal > 0 ? Math.round((guestsWithDates / guestsTotal) * 100) : 0,
      },
    };
  },

  /** Issues a one-use percentage offer on the best public rate for this guest. */
  async issuePromoCode(
    withTenant: WithTenantFn,
    actor: JwtPayload,
    guestId: string,
    dto: IssuePromoCodeDto,
  ) {
    const result = await withTenant(async (db) => {
      const guest = await db.guest.findFirst({
        where:  { id: guestId, deletedAt: null },
        select: { id: true, fullName: true, email: true, isBlacklisted: true, marketingOptIn: true },
      });
      if (!guest) throw new AppError(404, "Guest not found");
      if (guest.isBlacklisted) {
        throw new AppError(400, "Cannot issue a promo code to a blacklisted guest");
      }

      await acquireSubscriptionQuotaLock(db, actor.hotelId, "maxActivePromoCodes");
      const quotaDate = new Date(`${getCurrentPKTDate()}T00:00:00.000Z`);
      const activeCount = await db.ratePlanCode.count({
        where: {
          isActive: true,
          AND: [
            { OR: [{ validTo: null }, { validTo: { gte: quotaDate } }] },
            { OR: [{ maxUses: null }, { usedCount: 0 }] },
          ],
        },
      });
      await checkSubscriptionLimit(actor.hotelId, "maxActivePromoCodes", activeCount);

      const validFrom = quotaDate;
      const validTo = new Date(validFrom);
      validTo.setUTCDate(validTo.getUTCDate() + dto.validForDays);

      // Retry on the (hotelId, code) unique constraint rather than trusting a
      // single random draw to be free.
      let created = null;
      for (let attempt = 0; attempt < 5 && !created; attempt++) {
        const code = randomCode(dto.reason);
        const clash = await db.ratePlanCode.findFirst({ where: { code }, select: { id: true } });
        if (clash) continue;
        created = await db.ratePlanCode.create({
          data: {
            hotelId:     actor.hotelId,
            guestId:     guest.id,
            code,
            label:       dto.label ?? `${dto.reason.replace(/_/g, " ").toLowerCase()} offer`,
            issueReason: dto.reason,
            discountPercent: dto.discountPercent,
            maxUses:     1,
            validFrom,
            validTo,
            isActive:    true,
            emailStatus: "NOT_REQUESTED",
          },
        });
      }
      if (!created) throw new AppError(500, "Could not generate a unique code — please try again");

      await db.auditLog.create({
        data: {
          hotelId:  actor.hotelId,
          userId:   actor.userId,
          action:   "GUEST_PROMO_CODE_ISSUED",
          entity:   "guest",
          entityId: guest.id,
          after:    {
            code: created.code,
            reason: dto.reason,
            discountPercent: dto.discountPercent,
            validTo: validTo.toISOString(),
            emailRequested: dto.sendEmail,
            marketingConsentOverride: dto.sendEmail && dto.overrideMarketingConsent && !guest.marketingOptIn,
          },
        },
      });

      // `validTo` is carried out of the transaction explicitly rather than read
      // back off the row, so the email helper needs no non-null assertion.
      return { code: created, guest, validTo };
    });

    notifyHotelDataChanged(actor.hotelId);

    // Emailed after the transaction commits, so a mail failure cannot roll back
    // an already-issued code. Consent remains fail-closed for automated sends;
    // a manual one-message override is explicit in the DTO and audit record.
    // The override does not alter the guest's saved marketing preference.
    let queued = false;
    let queueFailed = false;
    if (dto.sendEmail) {
      try {
        queued = await enqueuePromoCodeEmail({
          codeId:    result.code.id,
          hotelId:   actor.hotelId,
          guestId:   result.guest.id,
          code:      result.code.code,
          offerName: `${dto.discountPercent}% off your next stay`,
          discountPercent: dto.discountPercent,
          validTo:   result.validTo,
          reason:    dto.reason,
          overrideMarketingConsent: dto.overrideMarketingConsent,
        });
      } catch (err) {
        console.error("Failed to enqueue promo code email:", err);
        queueFailed = true;
        await withTenant((db) => db.ratePlanCode.update({
          where: { id: result.code.id },
          data: { emailStatus: "FAILED", emailError: "Could not queue email" },
        }));
      }
    }

    return { ...result.code, emailStatus: queued ? "QUEUED" : (queueFailed ? "FAILED" : "NOT_REQUESTED") };
  },

  async listGuestPromoCodes(withTenant: WithTenantFn, guestId: string) {
    return withTenant((db) =>
      db.ratePlanCode.findMany({
        where:  { guestId },
        select: {
          id: true, code: true, label: true, issueReason: true,
          validFrom: true, validTo: true, isActive: true,
          maxUses: true, usedCount: true, lastUsedAt: true,
          discountPercent: true, emailStatus: true, emailSentAt: true, emailError: true,
          ratePlan: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      })
    );
  },

  async retryPromoEmail(withTenant: WithTenantFn, actor: JwtPayload, guestId: string, codeId: string) {
    const code = await withTenant((db) => db.ratePlanCode.findFirst({
      where: { id: codeId, guestId, discountPercent: { not: null }, isActive: true },
      select: { id: true, code: true, discountPercent: true, validTo: true, issueReason: true },
    }));
    if (!code || code.discountPercent === null || !code.validTo) {
      throw new AppError(404, "Active guest offer not found");
    }

    const queued = await enqueuePromoCodeEmail({
      codeId: code.id,
      hotelId: actor.hotelId,
      guestId,
      code: code.code,
      offerName: `${code.discountPercent}% off your next stay`,
      discountPercent: code.discountPercent,
      validTo: code.validTo,
      reason: code.issueReason ?? PromoIssueReason.MANUAL,
      retry: true,
    });
    if (!queued) {
      throw new AppError(400, "Email was not queued. Confirm the guest has an email address and has opted in to offers.");
    }
    return withTenant((db) => db.ratePlanCode.findUniqueOrThrow({ where: { id: codeId } }));
  },
};
