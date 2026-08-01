/**
 * Serialisers turning a canonical journal batch into an importable file.
 *
 * Pure string production, no `@pms/db` imports, so escaping behaviour can be
 * unit-tested directly — escaping bugs are the classic way a hotel name with an
 * apostrophe or a narration with a comma silently corrupts an import.
 */

import { formatAmount, type JournalBatch, type JournalLine } from "./journal";

// ── Generic journal CSV ──────────────────────────────────────────────────────

/**
 * Quotes a CSV field per RFC 4180.
 *
 * Also quotes leading `=`, `+`, `-` and `@`, which Excel and LibreOffice would
 * otherwise evaluate as a formula when the accountant opens the file.
 */
function csvField(value: string | number): string {
  const s = String(value);
  const needsFormulaGuard = /^[=+\-@]/.test(s);
  const body = needsFormulaGuard ? `'${s}` : s;
  if (/[",\r\n]/.test(body)) {
    return `"${body.replace(/"/g, '""')}"`;
  }
  return body;
}

const CSV_HEADERS = ["Date", "Account Code", "Account Name", "Debit", "Credit", "Narration", "Reference"];

export function genericJournalCsv(batch: JournalBatch): string {
  const rows = [
    CSV_HEADERS.join(","),
    ...batch.lines.map((l) => [
      csvField(l.date),
      csvField(l.accountCode),
      csvField(l.accountName),
      csvField(l.debit  === 0 ? "" : formatAmount(l.debit)),
      csvField(l.credit === 0 ? "" : formatAmount(l.credit)),
      csvField(l.narration),
      csvField(l.reference),
    ].join(",")),
  ];

  // A totals row lets the accountant confirm the file balances before importing.
  rows.push([
    csvField("TOTAL"), "", "",
    csvField(formatAmount(batch.totalDebit)),
    csvField(formatAmount(batch.totalCredit)),
    csvField(batch.balanced ? "Balanced" : "NOT BALANCED — do not import"),
    "",
  ].join(","));

  // CRLF: Excel on Windows is the overwhelmingly common consumer.
  return rows.join("\r\n") + "\r\n";
}

// ── Tally XML ────────────────────────────────────────────────────────────────

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Tally wants DD-MMM-YYYY in voucher dates and YYYYMMDD in the DATE field. */
function tallyDate(iso: string): string {
  return iso.replace(/-/g, "");
}

/**
 * Groups journal lines into one Tally journal voucher per date.
 *
 * Tally imports vouchers, not loose lines — every voucher must balance on its
 * own. Since the batch balances per day (each source event contributes both
 * sides on the same date), grouping by date is safe.
 */
function groupByDate(lines: JournalLine[]): Map<string, JournalLine[]> {
  const map = new Map<string, JournalLine[]>();
  for (const line of lines) {
    const bucket = map.get(line.date);
    if (bucket) bucket.push(line);
    else map.set(line.date, [line]);
  }
  return map;
}

/**
 * Tally journal vouchers.
 *
 * `REMOTEID` carries our stable reference so re-importing the same file updates
 * the existing voucher instead of creating a duplicate — the single most
 * important defence against a double import.
 *
 * Amounts follow Tally's sign convention: negative is a debit, positive is a
 * credit. This trips everyone up at least once.
 */
export function tallyJournalXml(batch: JournalBatch, companyName: string): string {
  const vouchers: string[] = [];

  for (const [date, lines] of groupByDate(batch.lines)) {
    const entries = lines.map((l) => {
      const isDebit = l.debit > 0;
      const amount  = isDebit ? -(l.debit / 100) : l.credit / 100;
      return `
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>${xmlEscape(l.accountName)}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>${isDebit ? "Yes" : "No"}</ISDEEMEDPOSITIVE>
            <AMOUNT>${amount.toFixed(2)}</AMOUNT>
          </ALLLEDGERENTRIES.LIST>`;
    }).join("");

    const remoteId = `PMS-JRNL-${date}`;
    vouchers.push(`
      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <VOUCHER VCHTYPE="Journal" ACTION="Create" OBJVIEW="Accounting Voucher View" REMOTEID="${xmlEscape(remoteId)}">
          <DATE>${tallyDate(date)}</DATE>
          <EFFECTIVEDATE>${tallyDate(date)}</EFFECTIVEDATE>
          <VOUCHERTYPENAME>Journal</VOUCHERTYPENAME>
          <NARRATION>${xmlEscape(`Hotel PMS daily journal ${date}`)}</NARRATION>
          <PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW>${entries}
        </VOUCHER>
      </TALLYMESSAGE>`);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${xmlEscape(companyName)}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>${vouchers.join("")}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>
`;
}

export function fileNameFor(format: string, from: string, to: string): string {
  const stem = `journal-${from}-to-${to}`;
  return format === "TALLY_XML" ? `${stem}.xml` : `${stem}.csv`;
}

export function contentTypeFor(format: string): string {
  return format === "TALLY_XML" ? "application/xml; charset=utf-8" : "text/csv; charset=utf-8";
}
