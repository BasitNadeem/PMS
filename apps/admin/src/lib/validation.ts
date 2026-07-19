// Mirror of apps/api/src/lib/validation.ts — keep logic in sync.

export function isValidEmail(input: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.trim());
}

export function getEmailErrorMessage(input: string): string | null {
  if (!input.trim()) return null;
  return isValidEmail(input) ? null : "Enter a valid email address";
}
