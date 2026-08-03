import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dueDateFor, agingBucketOf, summariseAging, allocatePayment,
  checkCreditLimit, daysBetween, outstandingOf,
  type OpenCharge,
} from "./companyCredit";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function charge(over: Partial<OpenCharge> & { id: string }): OpenCharge {
  return {
    amount: 100_000,
    settledAmount: 0,
    entryDate: d("2026-06-01"),
    dueDate: d("2026-07-01"),
    ...over,
  };
}

// ── due dates ────────────────────────────────────────────────────────────────

test("dueDateFor adds the net days of the term", () => {
  assert.deepEqual(dueDateFor(d("2026-08-02"), "NET_30"), d("2026-09-01"));
  assert.deepEqual(dueDateFor(d("2026-08-02"), "NET_7"),  d("2026-08-09"));
  assert.deepEqual(dueDateFor(d("2026-08-02"), "NET_90"), d("2026-10-31"));
});

test("IMMEDIATE terms fall due the same day", () => {
  assert.deepEqual(dueDateFor(d("2026-08-02"), "IMMEDIATE"), d("2026-08-02"));
});

test("dueDateFor rolls across month and year boundaries", () => {
  assert.deepEqual(dueDateFor(d("2026-12-20"), "NET_30"), d("2027-01-19"));
});

test("dueDateFor does not mutate the input date", () => {
  const entry = d("2026-08-02");
  dueDateFor(entry, "NET_60");
  assert.deepEqual(entry, d("2026-08-02"));
});

// ── aging ────────────────────────────────────────────────────────────────────

test("a charge is current until its due date passes", () => {
  const c = charge({ id: "a", dueDate: d("2026-07-01") });
  assert.equal(agingBucketOf(c, d("2026-06-15")), "current");
  assert.equal(agingBucketOf(c, d("2026-07-01")), "current", "due today is not yet overdue");
  assert.equal(agingBucketOf(c, d("2026-07-02")), "d1_30");
});

test("aging buckets count days past due, not days since the charge", () => {
  // Raised 1 Jan on NET_90 terms, so still current in March despite being old.
  const c = charge({ id: "a", entryDate: d("2026-01-01"), dueDate: d("2026-04-01") });
  assert.equal(agingBucketOf(c, d("2026-03-15")), "current");
});

test("aging bucket boundaries are inclusive at 30/60/90", () => {
  const c = charge({ id: "a", dueDate: d("2026-07-01") });
  assert.equal(agingBucketOf(c, d("2026-07-31")), "d1_30");   // 30 days
  assert.equal(agingBucketOf(c, d("2026-08-01")), "d31_60");  // 31 days
  assert.equal(agingBucketOf(c, d("2026-08-30")), "d31_60");  // 60 days
  assert.equal(agingBucketOf(c, d("2026-08-31")), "d61_90");  // 61 days
  assert.equal(agingBucketOf(c, d("2026-09-29")), "d61_90");  // 90 days
  assert.equal(agingBucketOf(c, d("2026-09-30")), "d90_plus");// 91 days
});

test("a charge with no due date is treated as due on its entry date", () => {
  const c = charge({ id: "a", entryDate: d("2026-06-01"), dueDate: null });
  assert.equal(agingBucketOf(c, d("2026-06-10")), "d1_30");
});

test("summariseAging splits outstanding amounts across buckets", () => {
  const summary = summariseAging([
    charge({ id: "a", amount: 100_000, dueDate: d("2026-09-01") }), // current
    charge({ id: "b", amount: 200_000, dueDate: d("2026-07-15") }), // 18 days
    charge({ id: "c", amount: 300_000, dueDate: d("2026-05-01") }), // 93 days
  ], d("2026-08-02"));

  assert.equal(summary.current,  100_000);
  assert.equal(summary.d1_30,    200_000);
  assert.equal(summary.d90_plus, 300_000);
  assert.equal(summary.total,    600_000);
  assert.equal(summary.overdue,  500_000);
  assert.equal(summary.oldestOverdueDays, 93);
});

test("summariseAging counts only the unpaid remainder of a part-paid charge", () => {
  const summary = summariseAging([
    charge({ id: "a", amount: 100_000, settledAmount: 70_000, dueDate: d("2026-07-15") }),
  ], d("2026-08-02"));
  assert.equal(summary.total,   30_000);
  assert.equal(summary.overdue, 30_000);
});

test("summariseAging ignores fully settled charges", () => {
  const summary = summariseAging([
    charge({ id: "a", amount: 100_000, settledAmount: 100_000, dueDate: d("2026-01-01") }),
  ], d("2026-08-02"));
  assert.equal(summary.total, 0);
  assert.equal(summary.oldestOverdueDays, null, "a settled charge is not the oldest overdue");
});

test("summariseAging on an empty ledger is all zeroes", () => {
  const summary = summariseAging([], d("2026-08-02"));
  assert.equal(summary.total, 0);
  assert.equal(summary.overdue, 0);
  assert.equal(summary.oldestOverdueDays, null);
});

// ── allocation ───────────────────────────────────────────────────────────────

test("allocatePayment settles oldest charges first", () => {
  const { allocations, unapplied } = allocatePayment(250_000, [
    charge({ id: "new", amount: 200_000, dueDate: d("2026-09-01") }),
    charge({ id: "old", amount: 200_000, dueDate: d("2026-06-01") }),
  ]);

  assert.deepEqual(allocations, [
    { chargeId: "old", amount: 200_000 },
    { chargeId: "new", amount: 50_000 },
  ]);
  assert.equal(unapplied, 0);
});

test("allocatePayment reports money left over once everything is settled", () => {
  const { allocations, unapplied } = allocatePayment(500_000, [
    charge({ id: "a", amount: 100_000 }),
  ]);
  assert.deepEqual(allocations, [{ chargeId: "a", amount: 100_000 }]);
  assert.equal(unapplied, 400_000);
});

test("allocatePayment respects the already-settled portion", () => {
  const { allocations, unapplied } = allocatePayment(50_000, [
    charge({ id: "a", amount: 100_000, settledAmount: 80_000 }),
  ]);
  assert.deepEqual(allocations, [{ chargeId: "a", amount: 20_000 }]);
  assert.equal(unapplied, 30_000);
});

test("allocatePayment skips fully settled charges", () => {
  const { allocations } = allocatePayment(50_000, [
    charge({ id: "done", amount: 100_000, settledAmount: 100_000, dueDate: d("2026-01-01") }),
    charge({ id: "open", amount: 100_000, dueDate: d("2026-07-01") }),
  ]);
  assert.deepEqual(allocations, [{ chargeId: "open", amount: 50_000 }]);
});

test("allocatePayment is deterministic when two charges share a due date", () => {
  const run = () => allocatePayment(150_000, [
    charge({ id: "zebra", amount: 100_000, dueDate: d("2026-07-01") }),
    charge({ id: "alpha", amount: 100_000, dueDate: d("2026-07-01") }),
  ]).allocations;
  assert.deepEqual(run(), run());
  assert.equal(run()[0]?.chargeId, "alpha");
});

test("allocatePayment on zero or negative amounts does nothing", () => {
  assert.deepEqual(allocatePayment(0,     [charge({ id: "a" })]), { allocations: [], unapplied: 0 });
  assert.deepEqual(allocatePayment(-5000, [charge({ id: "a" })]), { allocations: [], unapplied: 0 });
});

test("allocatePayment against no open charges leaves the whole amount unapplied", () => {
  assert.deepEqual(allocatePayment(100_000, []), { allocations: [], unapplied: 100_000 });
});

// ── credit limit ─────────────────────────────────────────────────────────────

test("a company with no credit limit cannot be billed", () => {
  const check = checkCreditLimit(0, 0, 50_000);
  assert.equal(check.allowed, false);
  assert.equal(check.available, 0);
  assert.match(check.reason ?? "", /no credit limit/i);
});

test("a charge within the remaining limit is allowed", () => {
  const check = checkCreditLimit(200_000, 500_000, 100_000);
  assert.equal(check.allowed, true);
  assert.equal(check.available, 300_000);
  assert.equal(check.shortfall, 0);
});

test("a charge that would breach the limit is refused with the shortfall", () => {
  const check = checkCreditLimit(400_000, 500_000, 250_000);
  assert.equal(check.allowed, false);
  assert.equal(check.available, 100_000);
  assert.equal(check.shortfall, 150_000);
});

test("a charge that exactly hits the limit is allowed", () => {
  assert.equal(checkCreditLimit(400_000, 500_000, 100_000).allowed, true);
});

test("an already over-limit company reports zero available, not negative", () => {
  const check = checkCreditLimit(900_000, 500_000, 1);
  assert.equal(check.available, 0);
  assert.equal(check.allowed, false);
});

// ── helpers ──────────────────────────────────────────────────────────────────

test("daysBetween ignores time of day", () => {
  assert.equal(
    daysBetween(new Date("2026-08-01T23:00:00Z"), new Date("2026-08-02T01:00:00Z")),
    1,
  );
});

test("outstandingOf never returns a negative", () => {
  assert.equal(outstandingOf(charge({ id: "a", amount: 100, settledAmount: 500 })), 0);
});
