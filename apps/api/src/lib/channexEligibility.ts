/**
 * Channex distribution rules — pure policy, no I/O.
 *
 * Kept separate from ChannexProvisioningService so the commercially sensitive
 * decisions here are unit-testable without a database or env, and so there is
 * exactly one place to audit "what may reach a public OTA".
 */

// ── OTA eligibility ──────────────────────────────────────────────────────────

/**
 * Rate plan types that may be distributed to public OTAs.
 *
 * Mirrors (deliberately does not import) the "SINGLE" public booking context in
 * RatePlanService's ELIGIBLE_TYPES. Copied rather than shared because that file
 * is being changed concurrently by the company-rate-agreements work; coupling
 * to it now would put a merge conflict in a commercially sensitive rule.
 * If the two ever diverge, this list is the authority for OTA distribution.
 *
 * TECHNICAL DEBT — reconcile before this drifts.
 * Once the company-rate-agreements work has landed, this rule and the
 * `p.companyId === null && ...includes(p.type) && !p.codeRequired` predicate in
 * RatePlanService.suggestRateCore must collapse to a single shared source.
 * Two independently maintained copies of a rule whose failure mode is "a
 * negotiated corporate discount appears on Booking.com" will eventually
 * diverge, and the divergence will be silent.
 *
 * Excluded on purpose:
 *   CORPORATE / TRAVEL_AGENT — negotiated trade rates.
 *   OTA_NET                  — net of commission. Published as a public sell
 *                              rate, the commission is given away twice.
 *   COMPLEMENTARY            — free stays.
 */
export const OTA_ELIGIBLE_RATE_PLAN_TYPES = ["STANDARD", "SEASONAL", "PROMOTIONAL"] as const;

export type RatePlanExclusionReason =
  | "COMPANY_CONTRACT"
  | "CODE_REQUIRED"
  | "NON_PUBLIC_TYPE"
  | "INACTIVE"
  | "NO_ROOM_TYPE";

const EXCLUSION_LABELS: Record<RatePlanExclusionReason, string> = {
  COMPANY_CONTRACT: "Private company contract — never published to OTAs",
  CODE_REQUIRED:    "Requires an access code — not public",
  NON_PUBLIC_TYPE:  "Rate type is not publicly distributable",
  INACTIVE:         "Rate plan is inactive",
  NO_ROOM_TYPE:     "No room type pricing configured",
};

export interface OtaEligibility {
  eligible: boolean;
  reason: RatePlanExclusionReason | null;
  /** Human-readable, for the Settings panel. */
  label: string | null;
}

export interface RatePlanEligibilityInput {
  isActive: boolean;
  codeRequired: boolean;
  companyId: string | null;
  type: string;
  roomTypeIds: string[];
}

/**
 * The single authority on whether a rate plan may reach a public OTA.
 *
 * A company-negotiated discount surfacing on Booking.com is a commercial
 * incident, so this fails closed: anything not positively recognised as public
 * is excluded. Every rejection carries a reason so the Settings panel can show
 * "3 of 7 synced, 4 excluded" instead of quietly dropping rates.
 */
export function evaluateOtaEligibility(plan: RatePlanEligibilityInput): OtaEligibility {
  const exclude = (reason: RatePlanExclusionReason): OtaEligibility =>
    ({ eligible: false, reason, label: EXCLUSION_LABELS[reason] });

  if (!plan.isActive) return exclude("INACTIVE");
  // Checked before type: a company contract is private whatever its type says.
  if (plan.companyId !== null) return exclude("COMPANY_CONTRACT");
  if (plan.codeRequired) return exclude("CODE_REQUIRED");
  if (!(OTA_ELIGIBLE_RATE_PLAN_TYPES as readonly string[]).includes(plan.type)) {
    return exclude("NON_PUBLIC_TYPE");
  }
  // A plan covering N room types is fully eligible: it maps to N Channex rate
  // plans, one per rate_plan_item, each carrying its own channex_rate_plan_id.
  if (plan.roomTypeIds.length === 0) return exclude("NO_ROOM_TYPE");

  return { eligible: true, reason: null, label: null };
}

// ── Hotel field validation ───────────────────────────────────────────────────

/**
 * Channex accepts a property with only title + currency, but refuses to connect
 * it to any OTA until these are present. Validating up front avoids creating a
 * half-configured property that fails confusingly much later.
 */
export interface HotelValidationResult {
  valid: boolean;
  /** Owner-facing field labels, ready to render. */
  missing: string[];
}

export interface HotelForValidation {
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  region: string | null;
  province: string | null;
  zipCode: string | null;
  latitude: unknown;
  longitude: unknown;
  settings: unknown;
}

export function settingsRecord(settings: unknown): Record<string, unknown> {
  return settings && typeof settings === "object" ? settings as Record<string, unknown> : {};
}

/**
 * Where in the Hotel Profile each missing field is filled in. The Settings
 * panel renders this so an owner is told exactly what to do rather than being
 * shown a bare refusal.
 */
export const CHANNEX_FIELD_LOCATIONS: Record<string, string> = {
  "Email address":     "Hotel Profile → Contact",
  "Phone number":      "Hotel Profile → Contact",
  "Street address":    "Hotel Profile → Location",
  "City":              "Hotel Profile → Location",
  "State / province":  "Hotel Profile → Location",
  "Postal / ZIP code": "Hotel Profile → Location",
  "Country":           "Hotel Profile → Location",
  "Latitude":          "Hotel Profile → Location",
  "Longitude":         "Hotel Profile → Location",
};

export function readZipCode(hotel: { zipCode: string | null }): string | null {
  return hotel.zipCode?.trim() || null;
}

export function validateHotelForChannex(hotel: HotelForValidation): HotelValidationResult {
  const missing: string[] = [];

  if (!hotel.email?.trim())   missing.push("Email address");
  if (!hotel.phone?.trim())   missing.push("Phone number");
  if (!hotel.address?.trim()) missing.push("Street address");
  if (!hotel.city?.trim())    missing.push("City");
  if (!hotel.country?.trim()) missing.push("Country");
  if (!(hotel.region?.trim() || hotel.province?.trim())) missing.push("State / province");
  if (!readZipCode(hotel)) missing.push("Postal / ZIP code");
  // Zero is a valid coordinate — only null/undefined counts as missing.
  if (hotel.latitude  === null || hotel.latitude  === undefined) missing.push("Latitude");
  if (hotel.longitude === null || hotel.longitude === undefined) missing.push("Longitude");

  return { valid: missing.length === 0, missing };
}

// ── Currency / timezone defaults ─────────────────────────────────────────────

/**
 * Innflo has no per-hotel currency column — PKR is implicit everywhere
 * (Payment.currencyCode defaults to it, hotels.country defaults to "PK").
 * Honours an explicit settings override should one ever be added.
 */
export function readCurrency(settings: unknown): string {
  const value = settingsRecord(settings).currency;
  return typeof value === "string" && value.trim() ? value.trim().toUpperCase() : "PKR";
}

export function readTimezone(settings: unknown): string {
  const value = settingsRecord(settings).timezone;
  return typeof value === "string" && value.trim() ? value.trim() : "Asia/Karachi";
}
