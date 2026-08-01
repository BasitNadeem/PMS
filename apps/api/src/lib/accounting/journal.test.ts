import assert from "node:assert/strict";
import test from "node:test";
import { debit, credit, summariseByDay, dropEmpty, buildBatch, formatAmount } from "./journal";

const CASH = { accountCode: "1100", accountName: "Cash in Hand" };
const ROOM = { accountCode: "4100", accountName: "Room Revenue" };
const AR   = { accountCode: "1200", accountName: "Accounts Receivable" };

test("a batch of matching debits and credits balances", () => {
  const batch = buildBatch("2026-08-01", "2026-08-31", [
    debit("2026-08-01", AR, 10_000, "Room night", "FOLIO_ITEM:1"),
    credit("2026-08-01", ROOM, 10_000, "Room night", "FOLIO_ITEM:1"),
  ]);
  assert.equal(batch.totalDebit, 10_000);
  assert.equal(batch.totalCredit, 10_000);
  assert.equal(batch.balanced, true);
});

test("a mismatched batch is reported as unbalanced", () => {
  const batch = buildBatch("2026-08-01", "2026-08-31", [
    debit("2026-08-01", AR, 10_000, "Room night", "FOLIO_ITEM:1"),
    credit("2026-08-01", ROOM, 9_999, "Room night", "FOLIO_ITEM:1"),
  ]);
  assert.equal(batch.balanced, false);
});

test("daily summary merges same account and side, and preserves the total", () => {
  const lines = [
    credit("2026-08-01", ROOM, 10_000, "Room 101", "FOLIO_ITEM:1"),
    credit("2026-08-01", ROOM,  5_000, "Room 102", "FOLIO_ITEM:2"),
    credit("2026-08-02", ROOM,  7_000, "Room 103", "FOLIO_ITEM:3"),
  ];
  const summary = summariseByDay(lines);

  assert.equal(summary.length, 2);
  assert.equal(summary[0]!.date, "2026-08-01");
  assert.equal(summary[0]!.credit, 15_000);
  assert.equal(summary[1]!.date, "2026-08-02");
  assert.equal(summary[1]!.credit, 7_000);
});

test("summarising keeps debits and credits on one account apart", () => {
  // A day with both a payment and a refund must still show the gross movement
  // on each side, not a netted single figure.
  const summary = summariseByDay([
    debit("2026-08-01", CASH, 10_000, "Payment", "PAYMENT:1"),
    credit("2026-08-01", CASH, 3_000, "Refund",  "PAYMENT:2"),
  ]);

  assert.equal(summary.length, 2);
  assert.equal(summary.find((l) => l.debit > 0)!.debit, 10_000);
  assert.equal(summary.find((l) => l.credit > 0)!.credit, 3_000);
});

test("summarising a balanced batch leaves it balanced", () => {
  const lines = [
    debit("2026-08-01", AR, 10_000, "Charge", "FOLIO_ITEM:1"),
    credit("2026-08-01", ROOM, 10_000, "Charge", "FOLIO_ITEM:1"),
    debit("2026-08-01", CASH, 4_000, "Payment", "PAYMENT:1"),
    credit("2026-08-01", AR, 4_000, "Payment", "PAYMENT:1"),
  ];
  const before = buildBatch("2026-08-01", "2026-08-01", lines);
  const after  = buildBatch("2026-08-01", "2026-08-01", summariseByDay(lines));

  assert.equal(before.balanced, true);
  assert.equal(after.balanced, true);
  assert.equal(after.totalDebit, before.totalDebit);
  assert.equal(after.totalCredit, before.totalCredit);
});

test("zero-value lines are dropped", () => {
  const lines = dropEmpty([
    debit("2026-08-01", AR, 0, "Nothing", "X:1"),
    debit("2026-08-01", AR, 500, "Something", "X:2"),
  ]);
  assert.equal(lines.length, 1);
  assert.equal(lines[0]!.debit, 500);
});

test("amounts render as minor units converted to two decimals", () => {
  assert.equal(formatAmount(0), "0.00");
  assert.equal(formatAmount(1), "0.01");
  assert.equal(formatAmount(123_456), "1234.56");
});
