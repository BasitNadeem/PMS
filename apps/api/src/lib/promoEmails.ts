import { adminPrisma } from "@pms/db";
import { promoEmailQueue, type PromoEmailReason } from "../jobs/queues";

const THEME_ACCENTS: Record<string, string> = {
  WARM_CLAY:    "#B85134",
  PINE_TEAL:    "#176B66",
  AZURE_SLATE:  "#326A8A",
  INDIGO_NIGHT: "#4F46A5",
};


export interface EnqueuePromoEmailArgs {
  codeId:        string;
  hotelId:       string;
  guestId:       string;
  code:          string;
  offerName:     string;
  discountPercent: number;
  validTo:       Date;
  reason:        PromoEmailReason;
  occasionLabel?: string | null;
  retry?: boolean;
  /** Manual one-message exception; automated occasion jobs must leave false. */
  overrideMarketingConsent?: boolean;
}

/**
 * Queues a promo code email, after checking that we are actually allowed to
 * send it.
 *
 * The guest must have an email address and must not be blacklisted. Marketing
 * consent is also required unless a manual caller explicitly records a
 * one-message override. Holding someone's
 * birthday — often captured off a CNIC for compliance — is not permission to
 * market to them, so automated callers never receive that exception.
 *
 * Returns false when the email was skipped. The code itself remains valid: a
 * guest with no email can still be handed the code at the desk or over the
 * phone.
 */
export async function enqueuePromoCodeEmail(args: EnqueuePromoEmailArgs): Promise<boolean> {
  const guest = await adminPrisma.guest.findFirst({
    where:  { id: args.guestId, hotelId: args.hotelId, deletedAt: null },
    select: { fullName: true, firstName: true, totalStays: true, email: true, marketingOptIn: true, isBlacklisted: true },
  });

  if (!guest?.email) return false;
  if (!guest.marketingOptIn && !args.overrideMarketingConsent) return false;
  if (guest.isBlacklisted) return false;

  const hotel = await adminPrisma.hotel.findUnique({
    where:  { id: args.hotelId },
    select: { name: true, phone: true, email: true, website: true, address: true, city: true, country: true, settings: true },
  });
  if (!hotel) return false;

  const settings = (hotel.settings ?? {}) as Record<string, unknown>;
  const themeKey = typeof settings.themeKey === "string" ? settings.themeKey : "WARM_CLAY";

  await promoEmailQueue.add(
    args.reason.toLowerCase().replace(/_/g, "-"),
    {
      hotelId:       args.hotelId,
      codeId:        args.codeId,
      guestEmail:    guest.email,
      guestName:      guest.fullName,
      guestFirstName: guest.firstName?.trim() || guest.fullName.split(" ")[0] || "there",
      stayCount:      guest.totalStays,
      hotelName:     hotel.name,
      hotelLogoUrl:  typeof settings.logoUrl === "string" ? settings.logoUrl : null,
      hotelAddress:  hotel.address,
      hotelCity:     hotel.city,
      hotelCountry:  hotel.country,
      hotelPhone:    hotel.phone,
      hotelEmail:    hotel.email,
      hotelWebsite:  hotel.website,
      accentColor:     THEME_ACCENTS[themeKey] ?? THEME_ACCENTS.WARM_CLAY,
      reason:        args.reason,
      occasionLabel: args.occasionLabel ?? null,
      code:          args.code,
      offerName:     args.offerName,
      discountPercent: args.discountPercent,
      validTo:       args.validTo.toISOString(),
    },
    {
      // The code is unique per issuance, so keying on it makes a retried
      // request or a double-clicked button send exactly one email.
      jobId: args.retry ? `promo-email-${args.code}-retry-${Date.now()}` : `promo-email-${args.code}`,
    },
  );

  await adminPrisma.ratePlanCode.updateMany({
    where: { id: args.codeId, hotelId: args.hotelId },
    data: { emailStatus: "QUEUED", emailError: null },
  });

  return true;
}
