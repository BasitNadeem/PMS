import assert from "node:assert/strict";
import test from "node:test";
import {
  FALLBACK_FEATURES,
  FALLBACK_LIMITS,
  FEATURE_KEYS,
  LIMIT_KEYS,
  hasTrialExpired,
  normalizeFeatureFlags,
  normalizeSubscriptionLimits,
} from "./subscriptionConfig";

test("feature normalization rejects unknown keys and defaults missing keys off", () => {
  const result = normalizeFeatureFlags({ bookingEngine: true, inventedFeature: true });
  assert.equal(result.bookingEngine, true);
  assert.equal(result.qrOrdering, false);
  assert.deepEqual(Object.keys(result), FEATURE_KEYS);
  assert.equal("inventedFeature" in result, false);
});

test("limit normalization preserves zero and explicit unlimited values", () => {
  const result = normalizeSubscriptionLimits({
    maxRooms: null,
    maxUsers: 12,
    maxActiveRatePlans: 0,
    maxActivePromoCodes: null,
  });
  assert.deepEqual(result, {
    maxRooms: null,
    maxUsers: 12,
    maxActiveRatePlans: 0,
    maxActivePromoCodes: null,
  });
});

test("invalid and absent limits fall back fail-closed", () => {
  const result = normalizeSubscriptionLimits({ maxRooms: -1, maxUsers: 2.5 });
  assert.deepEqual(result, FALLBACK_LIMITS);
  assert.deepEqual(Object.keys(result), LIMIT_KEYS);
  assert.equal(Object.values(FALLBACK_FEATURES).every((enabled) => !enabled), true);
});

test("hotel override normalization inherits each missing plan limit", () => {
  const plan = normalizeSubscriptionLimits({
    maxRooms: 20,
    maxUsers: 8,
    maxActiveRatePlans: 4,
    maxActivePromoCodes: 10,
  });
  const effective = normalizeSubscriptionLimits({ maxRooms: 25, maxUsers: null }, plan);
  assert.deepEqual(effective, {
    maxRooms: 25,
    maxUsers: null,
    maxActiveRatePlans: 4,
    maxActivePromoCodes: 10,
  });
});

test("trial expiry applies only to Trial accounts at or past the deadline", () => {
  const now = new Date("2026-08-01T12:00:00.000Z");
  assert.equal(hasTrialExpired(true, new Date("2026-08-01T11:59:59.000Z"), now), true);
  assert.equal(hasTrialExpired(true, new Date("2026-08-01T12:00:00.000Z"), now), true);
  assert.equal(hasTrialExpired(true, new Date("2026-08-01T12:00:01.000Z"), now), false);
  assert.equal(hasTrialExpired(false, new Date("2020-01-01T00:00:00.000Z"), now), false);
  assert.equal(hasTrialExpired(true, null, now), true);
});
