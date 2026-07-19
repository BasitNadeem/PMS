import { z } from "zod";

// ── Phone normalization ───────────────────────────────────────────────────────
// Frontend mirror: apps/web/src/lib/validation.ts — keep logic byte-for-byte
// in sync with this file whenever phone/email rules change.

/**
 * Accepts Pakistani mobile formats and normalises to E.164 (+923XXXXXXXXX).
 * Strips spaces, dashes, parentheses, and dots before parsing.
 * Returns null if the number is not a valid Pakistani mobile.
 *
 * Accepted input formats:
 *   +923XXXXXXXXX  — already E.164
 *    923XXXXXXXXX  — missing leading +
 *    03XXXXXXXXX   — local trunk prefix (11 digits)
 *     3XXXXXXXXX   — no prefix (10 digits)
 */
export function normalizePakistaniPhone(input: string): string | null {
  const cleaned = input.replace(/[\s\-().]/g, "");

  let local10: string;
  if (cleaned.startsWith("+92") && cleaned.length === 13) {
    local10 = cleaned.slice(3);
  } else if (cleaned.startsWith("92") && cleaned.length === 12) {
    local10 = cleaned.slice(2);
  } else if (cleaned.startsWith("0") && cleaned.length === 11) {
    local10 = cleaned.slice(1);
  } else if (cleaned.length === 10 && cleaned.startsWith("3")) {
    local10 = cleaned;
  } else {
    return null;
  }

  return /^3\d{9}$/.test(local10) ? `+92${local10}` : null;
}

/**
 * Structural E.164 sanity check for non-Pakistani numbers.
 * Requires a leading +, followed by 7–15 digits total.
 * Does not attempt country-specific validation.
 */
export function isValidInternationalPhone(input: string): boolean {
  const cleaned = input.replace(/[\s\-().]/g, "");
  return /^\+\d{7,15}$/.test(cleaned);
}

/**
 * Normalises a phone number to E.164, accepting both Pakistani mobile formats
 * and generic international E.164 numbers (already starting with +).
 * Returns null if the input matches neither format.
 */
export function normalizePhone(input: string): string | null {
  const pk = normalizePakistaniPhone(input);
  if (pk !== null) return pk;

  const cleaned = input.replace(/[\s\-().]/g, "");
  if (cleaned.startsWith("+") && isValidInternationalPhone(input)) {
    return cleaned;
  }
  return null;
}

// ── Reusable Zod schemas ──────────────────────────────────────────────────────

/** Required phone — validates format and normalises to E.164. */
export const phoneSchema = z
  .string()
  .trim()
  .transform((val, ctx): string => {
    const normalized = normalizePhone(val);
    if (!normalized) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid phone number format" });
      return z.NEVER as never;
    }
    return normalized;
  });

/**
 * Optional phone — empty string or undefined passes through as undefined;
 * any non-empty value must pass the format check.
 */
export const optionalPhoneSchema = z.preprocess(
  (v) => (v === "" ? undefined : v),
  z
    .string()
    .trim()
    .transform((val, ctx): string => {
      const normalized = normalizePhone(val);
      if (!normalized) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid phone number format" });
        return z.NEVER as never;
      }
      return normalized;
    })
    .optional(),
);

/** Required email — trims, lowercases, and validates format. */
export const emailSchema = z
  .string()
  .trim()
  .email("Invalid email address")
  .transform((v) => v.toLowerCase());

/**
 * Optional email — empty string or undefined passes through as undefined;
 * any non-empty value must be a valid email.
 */
export const optionalEmailSchema = z.preprocess(
  (v) => (v === "" ? undefined : v),
  z
    .string()
    .trim()
    .email("Invalid email address")
    .transform((v) => v.toLowerCase())
    .optional(),
);
