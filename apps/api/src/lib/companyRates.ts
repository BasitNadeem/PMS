export interface CompanyRateCandidate {
  id: string;
  companyId: string | null;
  rate: number;
}

export interface RatePlanEligibility {
  isActive: boolean;
  validFrom: Date | null;
  validTo: Date | null;
  daysOfWeek: number[];
  minLos: number;
}

/** A single nightly rate only applies when every charged night is eligible. */
export function ratePlanAppliesToStay(
  plan: RatePlanEligibility,
  checkIn: Date,
  checkOut: Date,
  nights: number,
): boolean {
  if (!plan.isActive || plan.minLos > nights) return false;
  if (plan.validFrom && checkIn < plan.validFrom) return false;

  const lastNight = new Date(checkOut);
  lastNight.setUTCDate(lastNight.getUTCDate() - 1);
  if (plan.validTo && lastNight > plan.validTo) return false;
  if (plan.daysOfWeek.length === 0) return true;

  for (let index = 0; index < nights; index += 1) {
    const night = new Date(checkIn);
    night.setUTCDate(night.getUTCDate() + index);
    if (!plan.daysOfWeek.includes(night.getUTCDay())) return false;
  }
  return true;
}

export interface CompanyRateDefaults {
  id: string;
  ratePlanId: string | null;
  discountPercent: number | null;
}

export type CompanyRateResolution =
  | { source: "COMPANY_CONTRACT"; plan: CompanyRateCandidate; rate: number }
  | { source: "COMPANY_DISCOUNT"; plan: null; rate: number; discountPercent: number }
  | null;

/**
 * Resolve the company-only layer of the rate waterfall.
 *
 * Candidates arrive in the Rate Plan engine's priority order. An exact
 * company-owned agreement wins, followed by the legacy one-plan default, then
 * the company's percentage discount. A candidate owned by another company can
 * never be selected, even if it has the highest priority.
 */
export function resolveCompanyRate(
  company: CompanyRateDefaults | null,
  candidates: CompanyRateCandidate[],
  baseRate: number,
): CompanyRateResolution {
  if (!company) return null;

  const exact = candidates.find((candidate) => candidate.companyId === company.id);
  const legacy = company.ratePlanId
    ? candidates.find((candidate) => candidate.id === company.ratePlanId && candidate.companyId === null)
    : undefined;
  const contract = exact ?? legacy;

  if (contract) return { source: "COMPANY_CONTRACT", plan: contract, rate: contract.rate };
  if (company.discountPercent !== null) {
    return {
      source: "COMPANY_DISCOUNT",
      plan: null,
      rate: Math.round(baseRate * (100 - company.discountPercent) / 100),
      discountPercent: company.discountPercent,
    };
  }
  return null;
}
