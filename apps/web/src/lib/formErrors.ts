import axios from "axios";

// Deliberately imports axios directly rather than the helpers in ./api — that
// module reads `import.meta.env` at load time, which makes anything importing
// it unusable outside a Vite build (including from a test runner). These two
// reads are small enough to keep local.

function responseData(err: unknown): { error?: string; details?: unknown } | undefined {
  if (!axios.isAxiosError(err)) return undefined;
  return err.response?.data as { error?: string; details?: unknown } | undefined;
}

/**
 * A validation failure reported by the API, keyed by form field name.
 *
 * The API returns `{ error: "Validation error", details: ZodIssue[] }`. Showing
 * only `error` tells the user "Validation error" and nothing else — they cannot
 * tell which of a dozen fields is wrong. These helpers pull the per-field
 * message out so it can be rendered against the field that actually failed.
 */
export type FieldErrors = Record<string, string>;

interface ApiIssue {
  path?: unknown;
  message?: unknown;
}

/**
 * Map an API error to `{ fieldName: message }`.
 *
 * Nested paths are joined with a dot (`leaderGuest.phone`) so a caller can look
 * up either the full path or, via `fieldErrorFor`, the leaf name.
 */
export function fieldErrorsFrom(err: unknown): FieldErrors {
  const details = responseData(err)?.details;
  if (!Array.isArray(details)) return {};

  const errors: FieldErrors = {};
  for (const raw of details as ApiIssue[]) {
    if (!raw || typeof raw !== "object") continue;
    const path = Array.isArray(raw.path) ? raw.path.filter((p) => typeof p === "string" || typeof p === "number") : [];
    const message = typeof raw.message === "string" ? raw.message : null;
    if (path.length === 0 || !message) continue;

    const key = path.join(".");
    // First issue per field wins — Zod can report several for one field and the
    // first is the most specific.
    if (!(key in errors)) errors[key] = message;
  }
  return errors;
}

/** Look up a field's message by full path or by its leaf name. */
export function fieldErrorFor(errors: FieldErrors, field: string): string | undefined {
  if (errors[field]) return errors[field];
  const leafMatch = Object.keys(errors).find((k) => k.split(".").pop() === field);
  return leafMatch ? errors[leafMatch] : undefined;
}

/**
 * Banner text for an API error.
 *
 * When the failure is field-level, the generic "Validation error" is replaced
 * with something that names the offending fields — otherwise a user staring at
 * a long form has no idea where to look, and if the field is scrolled out of
 * view the inline message alone is invisible.
 */
export function bannerMessageFor(err: unknown, labels: Record<string, string> = {}): string | null {
  if (!err) return null;

  const fields = fieldErrorsFrom(err);
  const keys = Object.keys(fields);
  if (keys.length > 0) {
    const named = keys.map((k) => {
      const leaf = k.split(".").pop() ?? k;
      return labels[k] ?? labels[leaf] ?? leaf;
    });
    return keys.length === 1
      ? `${named[0]}: ${fields[keys[0]!]}`
      : `Please check these fields: ${named.join(", ")}.`;
  }

  // No response at all (server down, connection refused) reads as a generic
  // failure otherwise, which is indistinguishable from a rejected request.
  const hasResponse = Boolean((err as { response?: unknown }).response);
  if (!hasResponse) {
    return "Could not reach the server. Check your connection and try again.";
  }

  return responseData(err)?.error ?? "Something went wrong. Please try again.";
}
