import assert from "node:assert/strict";
import test from "node:test";
import { paisasToChannexRate, channexRateToPaisas } from "./channexMoney";

// ── paisasToChannexRate ──────────────────────────────────────────────────────

test("formats whole rupees with two decimal places", () => {
  assert.equal(paisasToChannexRate(500_000), "5000.00");
  assert.equal(paisasToChannexRate(100), "1.00");
  assert.equal(paisasToChannexRate(0), "0.00");
});

test("the 100x trap: 5000 paisas is fifty rupees, not five thousand", () => {
  // This is the exact bug the utility exists to prevent — passing the paisa
  // integer straight to Channex would have meant "5000" -> 50.00.
  assert.equal(paisasToChannexRate(5_000), "50.00");
  assert.notEqual(paisasToChannexRate(5_000), "5000.00");
});

test("keeps sub-rupee amounts exact", () => {
  assert.equal(paisasToChannexRate(5), "0.05");
  assert.equal(paisasToChannexRate(50), "0.50");
  assert.equal(paisasToChannexRate(99), "0.99");
  assert.equal(paisasToChannexRate(101), "1.01");
});

test("handles large amounts without floating point drift", () => {
  assert.equal(paisasToChannexRate(123_456_789), "1234567.89");
  assert.equal(paisasToChannexRate(999_999_999_99), "999999999.99");
});

test("accepts bigint input", () => {
  assert.equal(paisasToChannexRate(500_000n), "5000.00");
  assert.equal(paisasToChannexRate(0n), "0.00");
  // Beyond Number.MAX_SAFE_INTEGER — bigint stays exact where number cannot.
  assert.equal(paisasToChannexRate(9_007_199_254_740_993n), "90071992547409.93");
});

test("preserves sign on negative amounts (refunds, corrections)", () => {
  assert.equal(paisasToChannexRate(-500_000), "-5000.00");
  assert.equal(paisasToChannexRate(-5), "-0.05");
});

test("rejects non-integer paisas rather than rounding money", () => {
  assert.throws(() => paisasToChannexRate(1234.56), TypeError);
  assert.throws(() => paisasToChannexRate(0.5), TypeError);
});

test("rejects non-finite and unsafe numbers", () => {
  assert.throws(() => paisasToChannexRate(NaN), TypeError);
  assert.throws(() => paisasToChannexRate(Infinity), TypeError);
  assert.throws(() => paisasToChannexRate(Number.MAX_SAFE_INTEGER + 2), TypeError);
});

// ── channexRateToPaisas ──────────────────────────────────────────────────────

test("parses the canonical two-decimal form", () => {
  assert.equal(channexRateToPaisas("5000.00"), 500_000);
  assert.equal(channexRateToPaisas("0.00"), 0);
  assert.equal(channexRateToPaisas("1.01"), 101);
});

test("accepts fewer than two decimal places", () => {
  assert.equal(channexRateToPaisas("5000"), 500_000);
  assert.equal(channexRateToPaisas("5000.5"), 500_050);
  assert.equal(channexRateToPaisas("0.5"), 50);
});

test("avoids the parseFloat rounding error", () => {
  // parseFloat("1234.56") * 100 === 123455.99999999999, which truncates to
  // 123455 — one paisa short. String arithmetic must give exactly 123456.
  assert.equal(channexRateToPaisas("1234.56"), 123_456);
  assert.equal(channexRateToPaisas("0.07"), 7);
  assert.equal(channexRateToPaisas("29.97"), 2_997);
});

test("tolerates surrounding whitespace", () => {
  assert.equal(channexRateToPaisas("  5000.00  "), 500_000);
});

test("parses negative amounts", () => {
  assert.equal(channexRateToPaisas("-5000.00"), -500_000);
  assert.equal(channexRateToPaisas("-0.05"), -5);
});

test("rejects more than two decimal places instead of silently truncating", () => {
  assert.throws(() => channexRateToPaisas("5000.005"), TypeError);
  assert.throws(() => channexRateToPaisas("1.234"), TypeError);
});

test("rejects malformed input", () => {
  for (const bad of ["", "abc", "1e3", "5,000.00", "5000.", ".5", "--5", "5 000", "NaN"]) {
    assert.throws(() => channexRateToPaisas(bad), TypeError, `expected "${bad}" to be rejected`);
  }
});

test("rejects a non-string argument", () => {
  assert.throws(() => channexRateToPaisas(5000 as unknown as string), TypeError);
});

// ── round trip ───────────────────────────────────────────────────────────────

test("round-trips every paisa value across a representative range", () => {
  const samples = [
    0, 1, 5, 9, 10, 99, 100, 101, 999, 1_000, 4_999, 5_000,
    123_456, 500_000, 1_000_000, 123_456_789, 99_999_999_99,
  ];
  for (const paisas of samples) {
    assert.equal(
      channexRateToPaisas(paisasToChannexRate(paisas)),
      paisas,
      `round trip failed for ${paisas}`,
    );
    if (paisas === 0) continue; // -0 formats to "0.00" and parses back to 0, which is correct
    assert.equal(
      channexRateToPaisas(paisasToChannexRate(-paisas)),
      -paisas,
      `round trip failed for -${paisas}`,
    );
  }
});

test("negative zero normalises to plain zero", () => {
  assert.equal(paisasToChannexRate(-0), "0.00");
  assert.equal(channexRateToPaisas("-0.00"), 0);
});

test("round-trips exhaustively across a contiguous block", () => {
  // Catches carry/padding errors at the 0.99 -> 1.00 boundaries.
  for (let paisas = 0; paisas <= 2_000; paisas++) {
    assert.equal(channexRateToPaisas(paisasToChannexRate(paisas)), paisas);
  }
});
