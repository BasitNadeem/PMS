/**
 * Walkthrough-request submission.
 *
 * The contact form records the lead here FIRST and only then offers WhatsApp,
 * so a visitor who never completes the WhatsApp hand-off is still a lead we
 * hold. Failure is returned rather than thrown: every failure mode has a
 * different fallback in the UI, and none of them should be a blank screen.
 */

// Vite inlines this at build time. Everything here ships in a public bundle,
// so this must never hold anything secret.
//
// The production default is a real URL, not "". Elsewhere in this repo an empty
// VITE_API_URL means "same origin" (see apps/web/src/lib/api.ts), but that is
// wrong here: the marketing site is served from innflo.co, where /api/* falls
// through to the SPA and returns HTML. A build that forgets the variable must
// still reach the API rather than silently refuse to submit.
const RAW_BASE = import.meta.env.VITE_API_URL?.trim();
const API_BASE = (
  RAW_BASE
    ? RAW_BASE
    : import.meta.env.DEV
      ? "http://localhost:4000"
      : "https://api.innflo.co"
).replace(/\/+$/, "");

const TIMEOUT_MS = 12_000;

export type WalkthroughLead = {
  name: string;
  email: string;
  property: string;
  city: string;
  rooms: string;
  phone: string;
  currentSystem: string;
  message: string;
  website: string;
};

export type LeadResult =
  | { ok: true }
  | { ok: false; message: string };

export async function submitWalkthroughRequest(lead: WalkthroughLead): Promise<LeadResult> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE}/api/public/marketing/walkthrough`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(lead),
      signal:  controller.signal,
    });

    // A 200 carrying HTML means the request landed on a static host's SPA
    // fallback rather than the API. Treating that as success would show the
    // visitor a confirmation for a lead nobody received.
    if (response.ok) {
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        return { ok: false, message: "We could not reach our servers just now." };
      }
      return { ok: true };
    }

    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    if (response.status === 429) {
      return { ok: false, message: body?.error ?? "Too many requests from this connection." };
    }
    return { ok: false, message: body?.error ?? "We could not record your request just now." };
  } catch {
    // Aborted, offline, DNS failure, blocked by an extension — all the same to
    // the visitor, and all recoverable by the fallbacks we show them.
    return { ok: false, message: "We could not reach our servers just now." };
  } finally {
    window.clearTimeout(timer);
  }
}
