export const FEATURE_DEFINITIONS = [
  { key: "whatsappBriefing",    label: "WhatsApp Briefing",      built: true },
  { key: "reportsExport",       label: "Reports Export",         built: true },
  { key: "inventoryManagement", label: "Inventory Management",   built: true },
  { key: "groupBookings",       label: "Group Bookings",         built: true },
  { key: "maintenanceTickets",  label: "Maintenance Tickets",    built: true },
  { key: "housekeepingPWA",     label: "Housekeeping Mobile App",built: true },
  { key: "posModule",           label: "POS Module",             built: true },
  { key: "qrOrdering",          label: "QR Ordering",            built: true },
  { key: "kitchenDisplay",      label: "Kitchen Display",        built: true },
  { key: "nightAudit",          label: "Night Audit",            built: true },
  { key: "auditLog",            label: "Audit Log",              built: true },
  { key: "ratePlans",           label: "Rate Plans",             built: true },
  { key: "bookingEngine",       label: "Booking Engine",         built: true },
  { key: "channelManager",      label: "Channel Manager",        built: false },
  { key: "customDomain",        label: "Custom Domain",          built: false },
  { key: "corporateBilling",    label: "Corporate Billing",      built: false },
] as const;

export const FEATURE_KEYS = FEATURE_DEFINITIONS.map((feature) => feature.key);
export type FeatureKey = typeof FEATURE_DEFINITIONS[number]["key"];

export const LIMIT_DEFINITIONS = [
  { key: "maxRooms",            label: "Active rooms",             minimum: 1, fallback: 5 },
  { key: "maxUsers",            label: "Active users",             minimum: 1, fallback: 1 },
  { key: "maxActiveRatePlans",  label: "Active rate plans",        minimum: 0, fallback: 0 },
  { key: "maxActivePromoCodes", label: "Active promo/corporate codes", minimum: 0, fallback: 0 },
] as const;

export const LIMIT_KEYS = LIMIT_DEFINITIONS.map((limit) => limit.key);
export type LimitKey = typeof LIMIT_DEFINITIONS[number]["key"];

export type SubscriptionLimits = Record<LimitKey, number | null>;
export type FeatureFlags = Record<FeatureKey, boolean>;

export const FALLBACK_LIMITS: SubscriptionLimits = Object.fromEntries(
  LIMIT_DEFINITIONS.map((limit) => [limit.key, limit.fallback]),
) as SubscriptionLimits;

export const FALLBACK_FEATURES: FeatureFlags = Object.fromEntries(
  FEATURE_KEYS.map((key) => [key, false]),
) as FeatureFlags;

export function normalizeFeatureFlags(value: unknown): FeatureFlags {
  const raw = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

  return Object.fromEntries(
    FEATURE_KEYS.map((key) => [key, raw[key] === true]),
  ) as FeatureFlags;
}

export function normalizeSubscriptionLimits(
  value: unknown,
  defaults: SubscriptionLimits = FALLBACK_LIMITS,
): SubscriptionLimits {
  const raw = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

  return Object.fromEntries(
    LIMIT_DEFINITIONS.map((definition) => {
      const candidate = raw[definition.key];
      if (candidate === null) return [definition.key, null];
      if (typeof candidate === "number" && Number.isInteger(candidate) && candidate >= definition.minimum) {
        return [definition.key, candidate];
      }
      return [definition.key, defaults[definition.key]];
    }),
  ) as SubscriptionLimits;
}

export function hasTrialExpired(
  isTrialAccount: boolean,
  trialEndsAt: Date | null,
  now = new Date(),
): boolean {
  return isTrialAccount && (!trialEndsAt || trialEndsAt.getTime() <= now.getTime());
}
