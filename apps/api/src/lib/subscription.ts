import { adminPrisma } from "@pms/db";
import { AppError } from "../utils/AppError";

const FEATURE_KEYS = [
  "whatsappBriefing", "reportsExport", "inventoryManagement",
  "groupBookings", "maintenanceTickets", "housekeepingPWA",
  "posModule", "qrOrdering", "kitchenDisplay", "nightAudit",
  "auditLog", "ratePlans", "bookingEngine", "channelManager", "customDomain",
  "corporateBilling",
] as const;

export type FeatureKey = typeof FEATURE_KEYS[number];

const FALLBACK_LIMITS = { maxRooms: 5, maxUsers: 1 };
const FALLBACK_FEATURES: Record<FeatureKey, boolean> = Object.fromEntries(
  FEATURE_KEYS.map((k) => [k, false])
) as Record<FeatureKey, boolean>;

export async function getEffectiveLimits(hotelId: string): Promise<{
  maxRooms: number;
  maxUsers: number;
  features: Record<FeatureKey, boolean>;
}> {
  const hotel = await adminPrisma.hotel.findUnique({
    where: { id: hotelId },
    select: {
      roomLimitOverride: true,
      featureOverrides: true,
      subscriptionPlan: {
        select: { maxRooms: true, maxUsers: true, features: true },
      },
    },
  });

  if (!hotel?.subscriptionPlan) {
    console.warn(`[subscription] Hotel ${hotelId} has no plan assigned — using fallback limits`);
    return { maxRooms: FALLBACK_LIMITS.maxRooms, maxUsers: FALLBACK_LIMITS.maxUsers, features: FALLBACK_FEATURES };
  }

  const plan = hotel.subscriptionPlan;
  const planFeatures = (plan.features ?? {}) as Record<string, boolean>;
  const overrides = (hotel.featureOverrides ?? {}) as Record<string, boolean>;

  const features = Object.fromEntries(
    FEATURE_KEYS.map((k) => [k, k in overrides ? overrides[k] : (planFeatures[k] ?? false)])
  ) as Record<FeatureKey, boolean>;

  return {
    maxRooms: hotel.roomLimitOverride ?? plan.maxRooms,
    maxUsers: plan.maxUsers,
    features,
  };
}

export async function checkFeatureAccess(hotelId: string, feature: FeatureKey): Promise<void> {
  const { features } = await getEffectiveLimits(hotelId);
  if (!features[feature]) {
    throw new AppError(403, `This feature requires a plan upgrade. Contact support to enable ${feature}.`);
  }
}

export async function checkRoomLimit(hotelId: string, currentCount: number): Promise<void> {
  const { maxRooms } = await getEffectiveLimits(hotelId);
  if (currentCount >= maxRooms) {
    throw new AppError(403, `Room limit reached (${maxRooms} rooms on your current plan).`);
  }
}

export async function checkUserLimit(hotelId: string, currentCount: number): Promise<void> {
  const { maxUsers } = await getEffectiveLimits(hotelId);
  if (currentCount >= maxUsers) {
    throw new AppError(403, `User limit reached (${maxUsers} users on your current plan).`);
  }
}
