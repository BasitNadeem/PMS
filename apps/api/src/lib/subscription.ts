import {
  adminPrisma,
  FALLBACK_FEATURES,
  FALLBACK_LIMITS,
  normalizeFeatureFlags,
  normalizeSubscriptionLimits,
  hasTrialExpired,
  type FeatureFlags,
  type FeatureKey,
  type LimitKey,
  type Prisma,
  type SubscriptionLimits,
} from "@pms/db";
import { AppError } from "../utils/AppError";

export interface EffectiveSubscription {
  limits: SubscriptionLimits;
  features: FeatureFlags;
  trialExpired: boolean;
}

export async function getEffectiveLimits(hotelId: string): Promise<EffectiveSubscription> {
  const hotel = await adminPrisma.hotel.findUnique({
    where: { id: hotelId },
    select: {
      isTrialAccount: true,
      trialEndsAt: true,
      limitOverrides: true,
      featureOverrides: true,
      subscriptionPlan: { select: { limits: true, features: true } },
    },
  });

  const trialExpired = hasTrialExpired(
    hotel?.isTrialAccount ?? false,
    hotel?.trialEndsAt ?? null,
  );

  if (!hotel?.subscriptionPlan || trialExpired) {
    if (!hotel?.subscriptionPlan) {
      console.warn(`[subscription] Hotel ${hotelId} has no plan assigned — using fallback limits`);
    }
    return {
      limits: FALLBACK_LIMITS,
      features: FALLBACK_FEATURES,
      trialExpired,
    };
  }

  const planLimits = normalizeSubscriptionLimits(hotel.subscriptionPlan.limits);
  const limits = normalizeSubscriptionLimits(hotel.limitOverrides, planLimits);
  const planFeatures = normalizeFeatureFlags(hotel.subscriptionPlan.features);
  const rawOverrides = hotel.featureOverrides && typeof hotel.featureOverrides === "object"
    && !Array.isArray(hotel.featureOverrides)
    ? hotel.featureOverrides as Record<string, unknown>
    : {};

  const features = Object.fromEntries(
    Object.entries(planFeatures).map(([key, enabled]) => [
      key,
      typeof rawOverrides[key] === "boolean" ? rawOverrides[key] : enabled,
    ]),
  ) as FeatureFlags;

  return { limits, features, trialExpired: false };
}

export async function checkFeatureAccess(hotelId: string, feature: FeatureKey): Promise<void> {
  const subscription = await getEffectiveLimits(hotelId);
  if (!subscription.features[feature]) {
    const reason = subscription.trialExpired
      ? "Your trial has expired. Choose a subscription plan to continue."
      : `This feature requires a plan upgrade. Contact support to enable ${feature}.`;
    throw new AppError(403, reason);
  }
}

export async function checkSubscriptionLimit(
  hotelId: string,
  limitKey: LimitKey,
  currentCount: number,
): Promise<void> {
  const { limits, trialExpired } = await getEffectiveLimits(hotelId);
  const limit = limits[limitKey];
  if (limit !== null && currentCount >= limit) {
    const labels: Record<LimitKey, string> = {
      maxRooms: "active rooms",
      maxUsers: "active users",
      maxActiveRatePlans: "active rate plans",
      maxActivePromoCodes: "active promo/corporate codes",
    };
    const reason = trialExpired
      ? "Your trial has expired. Choose a subscription plan to continue."
      : `Your current subscription plan allows up to ${limit} ${labels[limitKey]}. ` +
        "Deactivate an existing item or contact Innflo to upgrade.";
    throw new AppError(403, reason);
  }
}

/** Serializes quota-sensitive writes for one hotel and one limit key. */
export async function acquireSubscriptionQuotaLock(
  db: Prisma.TransactionClient,
  hotelId: string,
  limitKey: LimitKey,
): Promise<void> {
  // pg_advisory_xact_lock returns PostgreSQL's void type. Use executeRaw rather
  // than queryRaw so Prisma does not try to deserialize that void result.
  await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${hotelId}), hashtext(${limitKey}))`;
}

export const checkRoomLimit = (hotelId: string, count: number) =>
  checkSubscriptionLimit(hotelId, "maxRooms", count);

export const checkUserLimit = (hotelId: string, count: number) =>
  checkSubscriptionLimit(hotelId, "maxUsers", count);

export type { FeatureKey, LimitKey } from "@pms/db";
