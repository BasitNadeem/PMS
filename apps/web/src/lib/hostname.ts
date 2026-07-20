// Resolves which app to render — PMS or a hotel's public Booking Engine —
// from window.location.hostname. Called ONCE at app boot in App.tsx, not
// per-page: the decision is fixed for the lifetime of the page load, never
// re-evaluated mid-session.
//
// Hostname is NEVER used for auth or security decisions. It only picks which
// route tree renders, and (on the Booking Engine branch) pre-fills the
// hotel-slug field on the PMS login form as a UX convenience — the actual
// hotel context after login always comes from the JWT, exactly as before
// this file existed. A wrong/spoofed hostname can at most show the wrong
// public landing page; it can never grant access to anything.
export type AppMode =
  | { type: "pms" }
  | { type: "booking-engine"; hotelSlug: string };

export function resolveAppMode(): AppMode {
  const hostname = window.location.hostname;

  // Dev environments and the PMS app subdomain both mean "PMS".
  const PMS_HOSTNAMES = ["app.innflo.co", "localhost", "127.0.0.1"];
  if (PMS_HOSTNAMES.includes(hostname)) {
    return { type: "pms" };
  }

  // Any other *.innflo.co hostname → extract the hotel slug.
  const parts = hostname.split(".");
  if (parts.length >= 3 && hostname.endsWith(".innflo.co")) {
    return { type: "booking-engine", hotelSlug: parts[0] };
  }

  // Fallback (e.g. bare innflo.co somehow reaching this app, or an
  // unrecognized pattern) — default to PMS as the safest fallback rather
  // than guessing a hotel slug.
  return { type: "pms" };
}

// ── Local dev: testing the Booking Engine branch ─────────────────────────
// localhost always resolves to "pms" above, so the Booking Engine branch
// isn't reachable by default in dev. To test it locally, either:
//   1. Add a line to /etc/hosts mapping a real-looking hotel hostname to
//      localhost, e.g.:
//        127.0.0.1  demo-hotel.innflo.co
//      then visit http://demo-hotel.innflo.co:5173 — resolveAppMode() will
//      see hostname="demo-hotel.innflo.co", which matches the .innflo.co
//      branch and resolves to booking-engine mode with slug "demo-hotel".
//   2. Temporarily hardcode resolveAppMode() to return
//      `{ type: "booking-engine", hotelSlug: "demo-hotel" }` while testing,
//      and revert before committing.
