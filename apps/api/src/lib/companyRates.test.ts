import assert from "node:assert/strict";
import test from "node:test";
import { ratePlanAppliesToStay, resolveCompanyRate } from "./companyRates";

test("selects only the exact company's highest-priority contract", () => {
  const result = resolveCompanyRate(
    { id: "company-a", ratePlanId: null, discountPercent: 10 },
    [
      { id: "other-high", companyId: "company-b", rate: 5_000 },
      { id: "a-summer", companyId: "company-a", rate: 12_000 },
      { id: "a-old", companyId: "company-a", rate: 13_000 },
    ],
    15_000,
  );

  assert.deepEqual(result, {
    source: "COMPANY_CONTRACT",
    plan: { id: "a-summer", companyId: "company-a", rate: 12_000 },
    rate: 12_000,
  });
});

test("a fixed contract wins over the company's fallback discount", () => {
  const result = resolveCompanyRate(
    { id: "company-a", ratePlanId: null, discountPercent: 20 },
    [{ id: "contract", companyId: "company-a", rate: 11_000 }],
    15_000,
  );
  assert.equal(result?.source, "COMPANY_CONTRACT");
  assert.equal(result?.rate, 11_000);
});

test("uses percentage discount when no matching contract applies", () => {
  const result = resolveCompanyRate(
    { id: "company-a", ratePlanId: null, discountPercent: 15 },
    [{ id: "company-b-plan", companyId: "company-b", rate: 8_000 }],
    20_000,
  );
  assert.deepEqual(result, {
    source: "COMPANY_DISCOUNT",
    plan: null,
    rate: 17_000,
    discountPercent: 15,
  });
});

test("legacy default plan remains supported only when it is hotel-wide", () => {
  const result = resolveCompanyRate(
    { id: "company-a", ratePlanId: "legacy", discountPercent: null },
    [
      { id: "legacy", companyId: null, rate: 9_500 },
      { id: "legacy", companyId: "company-b", rate: 1_000 },
    ],
    12_000,
  );
  assert.equal(result?.source, "COMPANY_CONTRACT");
  assert.equal(result?.rate, 9_500);
});

test("returns no company override when no contract or discount exists", () => {
  assert.equal(resolveCompanyRate(
    { id: "company-a", ratePlanId: null, discountPercent: null },
    [],
    10_000,
  ), null);
});

test("a dated rate only applies when every charged night is inside its range", () => {
  const plan = {
    isActive: true,
    validFrom: new Date("2026-07-01"),
    validTo: new Date("2026-07-31"),
    daysOfWeek: [],
    minLos: 1,
  };

  assert.equal(ratePlanAppliesToStay(plan, new Date("2026-07-30"), new Date("2026-08-01"), 2), true);
  assert.equal(ratePlanAppliesToStay(plan, new Date("2026-07-31"), new Date("2026-08-02"), 2), false);
});

test("weekday eligibility checks every night using stable UTC dates", () => {
  const plan = {
    isActive: true,
    validFrom: null,
    validTo: null,
    daysOfWeek: [5, 6],
    minLos: 1,
  };

  assert.equal(ratePlanAppliesToStay(plan, new Date("2026-07-31"), new Date("2026-08-02"), 2), true);
  assert.equal(ratePlanAppliesToStay(plan, new Date("2026-07-31"), new Date("2026-08-03"), 3), false);
});
