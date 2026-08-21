/**
 * Money conversion across the Channex boundary.
 *
 * InnFlo stores every amount as an INTEGER in minor units (paisas).
 * Channex expects a DECIMAL STRING in major units: "5000.00".
 *
 * The trap this exists to prevent: passing the bare integer 5000 to Channex is
 * read as minor units and silently becomes 50.00 — a 100× underpricing that no
 * error surfaces. Every crossing goes through this pair; never inline the maths.
 *
 * Enforcement: paisasToChannexRate returns a branded `ChannexRate`, and every
 * Channex payload field that carries money is typed as `ChannexRate`. A raw
 * string literal or number will not typecheck, so the conversion cannot be
 * bypassed by accident.
 *
 * Currency assumption: 2 decimal places (PKR, USD, EUR, GBP…). Zero-decimal
 * currencies (JPY, KRW) and 3-decimal ones (KWD, BHD) would need a
 * currency-aware exponent — out of scope while InnFlo is PKR-first, and it
 * would be a change here rather than at any call site.
 */

declare const channexRateBrand: unique symbol;

/**
 * A Channex-formatted money string in major units, always with exactly two
 * decimal places. Obtainable only from paisasToChannexRate().
 */
export type ChannexRate = string & { readonly [channexRateBrand]: "ChannexRate" };

const MINOR_UNITS_PER_MAJOR = 100n;

/** "5000.00" / "5000" / "-12.5" — up to two decimal places, nothing exotic. */
const DECIMAL_STRING = /^(-?)(\d+)(?:\.(\d{1,2}))?$/;

/**
 * 500000 (paisas) -> "5000.00"
 *
 * @throws TypeError  on a non-integer, non-finite, or unsafe numeric input.
 *                    That is a programming error, not a runtime condition —
 *                    callers are not expected to catch it.
 */
export function paisasToChannexRate(paisas: number | bigint): ChannexRate {
  let value: bigint;

  if (typeof paisas === "bigint") {
    value = paisas;
  } else {
    if (!Number.isFinite(paisas)) {
      throw new TypeError(`paisasToChannexRate: expected a finite number, got ${paisas}`);
    }
    if (!Number.isInteger(paisas)) {
      throw new TypeError(
        `paisasToChannexRate: expected an integer in minor units, got ${paisas}. ` +
        "Amounts must already be paisas — do not divide before calling this.",
      );
    }
    if (!Number.isSafeInteger(paisas)) {
      throw new TypeError(`paisasToChannexRate: ${paisas} exceeds the safe integer range`);
    }
    value = BigInt(paisas);
  }

  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const major = absolute / MINOR_UNITS_PER_MAJOR;
  const minor = absolute % MINOR_UNITS_PER_MAJOR;

  return `${negative ? "-" : ""}${major}.${minor.toString().padStart(2, "0")}` as ChannexRate;
}

/**
 * "5000.00" -> 500000 (paisas)
 *
 * Deliberately string arithmetic, not `parseFloat(rate) * 100`: that route
 * returns 123455.99999999999 for "1234.56" and truncates to a paisa short.
 *
 * @throws TypeError  when the input is not a plain decimal with at most two
 *                    decimal places. Rejecting beats silently rounding money;
 *                    ingestion callers catch this and mark the event FAILED.
 */
export function channexRateToPaisas(rate: string): number {
  if (typeof rate !== "string") {
    throw new TypeError(`channexRateToPaisas: expected a string, got ${typeof rate}`);
  }

  const match = DECIMAL_STRING.exec(rate.trim());
  if (!match) {
    throw new TypeError(
      `channexRateToPaisas: "${rate}" is not a decimal amount with at most two ` +
      "decimal places",
    );
  }

  const [, sign, majorPart, minorPart = ""] = match;
  const minor = minorPart.padEnd(2, "0");
  const total = BigInt(majorPart) * MINOR_UNITS_PER_MAJOR + BigInt(minor);
  const signed = sign === "-" ? -total : total;

  if (signed > BigInt(Number.MAX_SAFE_INTEGER) || signed < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new TypeError(`channexRateToPaisas: "${rate}" exceeds the safe integer range in paisas`);
  }

  return Number(signed);
}
