// Phone and email validation utilities.
// Backend mirror: apps/api/src/lib/validation.ts — keep logic in sync.

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

function isValidInternationalPhone(input: string): boolean {
  const cleaned = input.replace(/[\s\-().]/g, "");
  return /^\+\d{7,15}$/.test(cleaned);
}

export function normalizePhone(input: string): string | null {
  const pk = normalizePakistaniPhone(input);
  if (pk !== null) return pk;
  const cleaned = input.replace(/[\s\-().]/g, "");
  if (cleaned.startsWith("+") && isValidInternationalPhone(input)) return cleaned;
  return null;
}

export function isValidEmail(input: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.trim());
}

/** Returns an error string if invalid, null if valid or empty (empty handled by required check). */
export function getPhoneErrorMessage(input: string): string | null {
  if (!input.trim()) return null;
  return normalizePhone(input) !== null ? null : "Enter a valid phone number (e.g. 03001234567)";
}

/** Returns an error string if invalid, null if valid or empty. */
export function getEmailErrorMessage(input: string): string | null {
  if (!input.trim()) return null;
  return isValidEmail(input) ? null : "Enter a valid email address";
}
