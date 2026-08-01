import assert from "node:assert/strict";
import test from "node:test";
import { genericJournalCsv, tallyJournalXml, fileNameFor } from "./formats";
import { debit, credit, buildBatch } from "./journal";

const AR   = { accountCode: "1200", accountName: "Accounts Receivable" };
const ROOM = { accountCode: "4100", accountName: "Room Revenue" };

function simpleBatch() {
  return buildBatch("2026-08-01", "2026-08-01", [
    debit("2026-08-01", AR, 10_000, "Room night", "FOLIO_ITEM:1"),
    credit("2026-08-01", ROOM, 10_000, "Room night", "FOLIO_ITEM:1"),
  ]);
}

// ── CSV ──────────────────────────────────────────────────────────────────────

test("CSV has a header, one row per line, and a totals row", () => {
  const rows = genericJournalCsv(simpleBatch()).trim().split("\r\n");
  assert.equal(rows.length, 4);
  assert.match(rows[0]!, /^Date,Account Code/);
  assert.match(rows[3]!, /^TOTAL/);
});

test("CSV writes a debit in the debit column and leaves credit blank", () => {
  const rows = genericJournalCsv(simpleBatch()).trim().split("\r\n");
  assert.equal(rows[1], "2026-08-01,1200,Accounts Receivable,100.00,,Room night,FOLIO_ITEM:1");
});

test("CSV quotes fields containing commas and doubles embedded quotes", () => {
  const batch = buildBatch("2026-08-01", "2026-08-01", [
    debit("2026-08-01", AR, 100, 'Room 5, "deluxe"', "FOLIO_ITEM:1"),
    credit("2026-08-01", ROOM, 100, "x", "FOLIO_ITEM:1"),
  ]);
  const rows = genericJournalCsv(batch).trim().split("\r\n");
  assert.ok(rows[1]!.includes('"Room 5, ""deluxe"""'));
});

test("CSV neutralises a narration that a spreadsheet would run as a formula", () => {
  const batch = buildBatch("2026-08-01", "2026-08-01", [
    debit("2026-08-01", AR, 100, "=1+1", "FOLIO_ITEM:1"),
    credit("2026-08-01", ROOM, 100, "x", "FOLIO_ITEM:1"),
  ]);
  const rows = genericJournalCsv(batch).trim().split("\r\n");
  assert.ok(rows[1]!.includes("'=1+1"), "leading = should be prefixed so Excel treats it as text");
});

test("CSV marks an unbalanced batch in the totals row", () => {
  const batch = buildBatch("2026-08-01", "2026-08-01", [
    debit("2026-08-01", AR, 100, "x", "FOLIO_ITEM:1"),
    credit("2026-08-01", ROOM, 90, "x", "FOLIO_ITEM:1"),
  ]);
  assert.match(genericJournalCsv(batch), /NOT BALANCED/);
});

// ── Tally XML ────────────────────────────────────────────────────────────────

test("Tally XML wraps vouchers in an import envelope naming the company", () => {
  const xml = tallyJournalXml(simpleBatch(), "Hunza Lodge");
  assert.match(xml, /<TALLYREQUEST>Import Data<\/TALLYREQUEST>/);
  assert.match(xml, /<SVCURRENTCOMPANY>Hunza Lodge<\/SVCURRENTCOMPANY>/);
  assert.match(xml, /<VOUCHERTYPENAME>Journal<\/VOUCHERTYPENAME>/);
});

test("Tally XML uses negative amounts for debits and positive for credits", () => {
  const xml = tallyJournalXml(simpleBatch(), "H");
  assert.match(xml, /<LEDGERNAME>Accounts Receivable<\/LEDGERNAME>\s*<ISDEEMEDPOSITIVE>Yes<\/ISDEEMEDPOSITIVE>\s*<AMOUNT>-100\.00<\/AMOUNT>/);
  assert.match(xml, /<LEDGERNAME>Room Revenue<\/LEDGERNAME>\s*<ISDEEMEDPOSITIVE>No<\/ISDEEMEDPOSITIVE>\s*<AMOUNT>100\.00<\/AMOUNT>/);
});

test("Tally XML carries a stable REMOTEID so a re-import updates rather than duplicates", () => {
  assert.match(tallyJournalXml(simpleBatch(), "H"), /REMOTEID="PMS-JRNL-2026-08-01"/);
});

test("Tally XML dates are YYYYMMDD", () => {
  assert.match(tallyJournalXml(simpleBatch(), "H"), /<DATE>20260801<\/DATE>/);
});

test("Tally XML escapes characters that would break the document", () => {
  const batch = buildBatch("2026-08-01", "2026-08-01", [
    debit("2026-08-01", { accountCode: "1", accountName: "Smith & Sons <Ltd>" }, 100, "x", "R:1"),
    credit("2026-08-01", { accountCode: "2", accountName: "O'Brien" }, 100, "x", "R:1"),
  ]);
  const xml = tallyJournalXml(batch, `Bob's "Inn" & Co`);
  assert.match(xml, /Smith &amp; Sons &lt;Ltd&gt;/);
  assert.match(xml, /O&apos;Brien/);
  assert.match(xml, /Bob&apos;s &quot;Inn&quot; &amp; Co/);
  assert.ok(!/&(?!amp;|lt;|gt;|quot;|apos;)/.test(xml), "no unescaped ampersands should remain");
});

test("one voucher is emitted per date", () => {
  const batch = buildBatch("2026-08-01", "2026-08-02", [
    debit("2026-08-01", AR, 100, "x", "R:1"),
    credit("2026-08-01", ROOM, 100, "x", "R:1"),
    debit("2026-08-02", AR, 200, "y", "R:2"),
    credit("2026-08-02", ROOM, 200, "y", "R:2"),
  ]);
  const xml = tallyJournalXml(batch, "H");
  assert.equal(xml.match(/<VOUCHER /g)?.length, 2);
});

// ── File naming ──────────────────────────────────────────────────────────────

test("file names carry the period and the right extension", () => {
  assert.equal(fileNameFor("GENERIC_CSV", "2026-08-01", "2026-08-31"), "journal-2026-08-01-to-2026-08-31.csv");
  assert.equal(fileNameFor("TALLY_XML",   "2026-08-01", "2026-08-31"), "journal-2026-08-01-to-2026-08-31.xml");
});
