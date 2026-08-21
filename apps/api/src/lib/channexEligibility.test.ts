import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateOtaEligibility,
  validateHotelForChannex,
  OTA_ELIGIBLE_RATE_PLAN_TYPES,
  type RatePlanEligibilityInput,
} from "../lib/channexEligibility";

// A plan that passes every check — each test breaks exactly one thing.
function publicPlan(overrides: Partial<RatePlanEligibilityInput> = {}): RatePlanEligibilityInput {
  return {
    isActive: true,
    codeRequired: false,
    companyId: null,
    type: "STANDARD",
    roomTypeIds: ["room-type-1"],
    ...overrides,
  };
}

// ── The commercial boundary ──────────────────────────────────────────────────

test("a plain public rate plan is OTA eligible", () => {
  const result = evaluateOtaEligibility(publicPlan());
  assert.equal(result.eligible, true);
  assert.equal(result.reason, null);
});

test("a company contract is never OTA eligible", () => {
  // The headline risk: a negotiated corporate discount appearing on Booking.com.
  const result = evaluateOtaEligibility(publicPlan({ companyId: "company-1" }));
  assert.equal(result.eligible, false);
  assert.equal(result.reason, "COMPANY_CONTRACT");
});

test("a company contract is excluded even when its type looks public", () => {
  for (const type of OTA_ELIGIBLE_RATE_PLAN_TYPES) {
    const result = evaluateOtaEligibility(publicPlan({ companyId: "company-1", type }));
    assert.equal(result.eligible, false, `${type} + company must be excluded`);
    assert.equal(result.reason, "COMPANY_CONTRACT");
  }
});

test("a code-required plan is excluded", () => {
  const result = evaluateOtaEligibility(publicPlan({ codeRequired: true }));
  assert.equal(result.eligible, false);
  assert.equal(result.reason, "CODE_REQUIRED");
});

test("negotiated and non-public rate types are excluded", () => {
  for (const type of ["CORPORATE", "TRAVEL_AGENT", "OTA_NET", "COMPLEMENTARY"]) {
    const result = evaluateOtaEligibility(publicPlan({ type }));
    assert.equal(result.eligible, false, `${type} must not reach an OTA`);
    assert.equal(result.reason, "NON_PUBLIC_TYPE");
  }
});

test("only STANDARD, SEASONAL and PROMOTIONAL are distributable", () => {
  assert.deepEqual([...OTA_ELIGIBLE_RATE_PLAN_TYPES], ["STANDARD", "SEASONAL", "PROMOTIONAL"]);
  for (const type of OTA_ELIGIBLE_RATE_PLAN_TYPES) {
    assert.equal(evaluateOtaEligibility(publicPlan({ type })).eligible, true);
  }
});

test("an inactive plan is excluded", () => {
  const result = evaluateOtaEligibility(publicPlan({ isActive: false }));
  assert.equal(result.eligible, false);
  assert.equal(result.reason, "INACTIVE");
});

test("a plan with no room type pricing is excluded", () => {
  const result = evaluateOtaEligibility(publicPlan({ roomTypeIds: [] }));
  assert.equal(result.eligible, false);
  assert.equal(result.reason, "NO_ROOM_TYPE");
});

test("a plan spanning multiple room types is eligible", () => {
  // Each (plan x room type) pair becomes its own Channex rate plan, with the
  // id stored on the rate_plan_item — so breadth is not a barrier.
  const result = evaluateOtaEligibility(publicPlan({ roomTypeIds: ["rt-1", "rt-2", "rt-3"] }));
  assert.equal(result.eligible, true);
  assert.equal(result.reason, null);
});

test("it fails closed on an unrecognised rate type", () => {
  const result = evaluateOtaEligibility(publicPlan({ type: "SOME_FUTURE_TYPE" }));
  assert.equal(result.eligible, false);
  assert.equal(result.reason, "NON_PUBLIC_TYPE");
});

test("every exclusion carries an owner-facing label", () => {
  const excluded = [
    publicPlan({ isActive: false }),
    publicPlan({ companyId: "c1" }),
    publicPlan({ codeRequired: true }),
    publicPlan({ type: "CORPORATE" }),
    publicPlan({ roomTypeIds: [] }),
  ];
  for (const plan of excluded) {
    const result = evaluateOtaEligibility(plan);
    assert.equal(result.eligible, false);
    assert.ok(result.label && result.label.length > 0, `missing label for ${result.reason}`);
  }
});

// ── Hotel validation ─────────────────────────────────────────────────────────

function completeHotel(overrides: Record<string, unknown> = {}) {
  return {
    email: "owner@hotel.test",
    phone: "+923001234567",
    address: "1 Mall Road",
    city: "Lahore",
    country: "PK",
    region: "Punjab",
    province: null,
    latitude: "31.5204000",
    longitude: "74.3587000",
    zipCode: "54000",
    settings: {},
    ...overrides,
  };
}

test("a fully configured hotel passes validation", () => {
  const result = validateHotelForChannex(completeHotel());
  assert.equal(result.valid, true);
  assert.deepEqual(result.missing, []);
});

test("it names every missing field rather than failing generically", () => {
  const result = validateHotelForChannex(completeHotel({
    email: null, phone: null, latitude: null, zipCode: null,
  }));
  assert.equal(result.valid, false);
  assert.deepEqual(result.missing.sort(), [
    "Email address", "Latitude", "Phone number", "Postal / ZIP code",
  ].sort());
});

test("province substitutes for region as the state field", () => {
  const result = validateHotelForChannex(completeHotel({ region: null, province: "Sindh" }));
  assert.equal(result.valid, true);
});

test("a hotel with neither region nor province is missing state", () => {
  const result = validateHotelForChannex(completeHotel({ region: null, province: null }));
  assert.equal(result.valid, false);
  assert.ok(result.missing.includes("State / province"));
});

test("a blank postal code does not satisfy the requirement", () => {
  for (const value of [null, "", "   "]) {
    const result = validateHotelForChannex(completeHotel({ zipCode: value }));
    assert.equal(result.valid, false, `${JSON.stringify(value)} should be rejected`);
    assert.ok(result.missing.includes("Postal / ZIP code"));
  }
});

test("blank strings do not satisfy a required field", () => {
  const result = validateHotelForChannex(completeHotel({ email: "   ", city: "" }));
  assert.equal(result.valid, false);
  assert.ok(result.missing.includes("Email address"));
  assert.ok(result.missing.includes("City"));
});

test("longitude of zero is a real coordinate, not a missing value", () => {
  const result = validateHotelForChannex(completeHotel({ longitude: "0" }));
  assert.equal(result.valid, true);
});
