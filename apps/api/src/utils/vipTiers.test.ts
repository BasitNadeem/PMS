import assert from "node:assert/strict";
import test from "node:test";
import { vipLevelForStays, parseVipThresholds, DEFAULT_VIP_THRESHOLDS } from "./vipTiers";

test("a guest below the first threshold earns no tier", () => {
  assert.equal(vipLevelForStays(0), 0);
  assert.equal(vipLevelForStays(2), 0);
});

test("tiers are awarded at each default threshold", () => {
  assert.equal(vipLevelForStays(3),  1);
  assert.equal(vipLevelForStays(9),  1);
  assert.equal(vipLevelForStays(10), 2);
  assert.equal(vipLevelForStays(19), 2);
  assert.equal(vipLevelForStays(20), 3);
});

test("stays beyond the top threshold stay at the top tier", () => {
  assert.equal(vipLevelForStays(500), 3);
});

test("a hotel can raise its own thresholds", () => {
  const strict: [number, number, number] = [10, 25, 50];
  assert.equal(vipLevelForStays(3,  strict), 0);
  assert.equal(vipLevelForStays(10, strict), 1);
  assert.equal(vipLevelForStays(25, strict), 2);
  assert.equal(vipLevelForStays(50, strict), 3);
});

test("defaults are ascending, so a higher tier is always harder to reach", () => {
  const [one, two, three] = DEFAULT_VIP_THRESHOLDS;
  assert.ok(one < two && two < three);
});

test("valid hotel thresholds are read from settings", () => {
  assert.deepEqual(parseVipThresholds({ vipThresholds: [5, 15, 40] }), [5, 15, 40]);
});

test("malformed thresholds fall back to defaults rather than breaking checkout", () => {
  for (const settings of [
    null,
    {},
    { vipThresholds: "3,10,20" },
    { vipThresholds: [3, 10] },                // too few
    { vipThresholds: [3, 10, 20, 30] },        // too many
    { vipThresholds: [3, "10", 20] },          // not all numbers
    { vipThresholds: [0, 10, 20] },            // zero is not a reachable tier
    { vipThresholds: [-1, 10, 20] },
    { vipThresholds: [20, 10, 3] },            // descending
    { vipThresholds: [10, 10, 20] },           // duplicate boundary
  ]) {
    assert.deepEqual(
      parseVipThresholds(settings),
      DEFAULT_VIP_THRESHOLDS,
      `expected fallback for ${JSON.stringify(settings)}`,
    );
  }
});
