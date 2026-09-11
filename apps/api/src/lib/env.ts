import { z } from "zod";
import "dotenv/config";

const envSchema = z.object({
  DATABASE_URL:            z.string().url(),
  DIRECT_URL:              z.string().url().optional(),
  JWT_SECRET:              z.string().min(16),
  JWT_EXPIRES_IN:          z.string().default("1h"),
  JWT_REFRESH_EXPIRES_IN:  z.string().default("7d"),
  PORT:                    z.coerce.number().default(4000),
  NODE_ENV:                z.enum(["development", "production", "test"]).default("development"),
  ADMIN_CORS_ORIGIN:       z.string().url().default("http://localhost:5174"),
  // Base domain for the multi-tenant CORS check in production — every hotel gets its own
  // subdomain (e.g. demo-hotel.innflo.co), so CORS must match the whole *.innflo.co family
  // rather than a single fixed origin. See index.ts's cors() config.
  PRODUCTION_DOMAIN:       z.string().default("innflo.co"),
  // Deliberately separate from NODE_ENV: a misconfigured/missing NODE_ENV should never be
  // able to silently disable CORS by accident. This must be explicitly opted into for local
  // dev only — it is never present in the production .env.example, so it defaults to false
  // (safe) anywhere it isn't set on purpose.
  // NOT z.coerce.boolean() — that coerces via JS's Boolean(str), where any non-empty string
  // (including the literal text "false") is truthy. Only the exact string "true" opens this.
  ALLOW_DEV_CORS_BYPASS:   z.string().optional().transform((v) => v === "true"),
  // Base URL other origins use to reach THIS API server — needed because uploaded file
  // URLs (see routes/upload.ts) are stored and rendered on completely different origins
  // (app.innflo.co, every *.innflo.co hotel subdomain). A relative "/uploads/xxx.jpg"
  // only resolves correctly on the API's own origin; every other consumer sees a broken
  // image. Optional here (not .default()) so the superRefine below can require it in
  // production specifically — the dev fallback is derived from PORT after parsing.
  API_PUBLIC_URL:          z.string().url().optional(),
  REDIS_URL:               z.string().default("redis://localhost:6379"),
  ADMIN_EMAIL:             z.string().email().default("admin@yourpms.com"),
  ADMIN_PASSWORD:          z.string().default("AdminPass123!"),
  ADMIN_JWT_SECRET:        z.string().default("admin-secret-change-in-prod"),
  VAPID_PUBLIC_KEY:        z.string(),
  VAPID_PRIVATE_KEY:       z.string(),
  VAPID_EMAIL:             z.string(),
  // ── Image storage (Cloudinary — swap to S3 vars when migrating) ─────────────
  CLOUDINARY_CLOUD_NAME:   z.string().optional(),
  CLOUDINARY_API_KEY:      z.string().optional(),
  CLOUDINARY_API_SECRET:   z.string().optional(),
  // ── Vision API (Google Vision — swap to ANTHROPIC_API_KEY when migrating) ───
  GOOGLE_VISION_API_KEY:   z.string().optional(),
  // ── Transactional email (Brevo) ──────────────────────────────────────────
  BREVO_API_KEY:           z.string(),
  BREVO_FROM_EMAIL:        z.string().email(),
  BREVO_FROM_NAME:         z.string(),
  // Local-dev-only: print emails to the console instead of sending them, so the
  // whole flow can be exercised without a working Brevo key. Gated on its own
  // explicit flag rather than NODE_ENV, for the same reason as
  // ALLOW_DEV_CORS_BYPASS above — an ambient string that could be missing or
  // wrong in a given deployment must never be able to silently stop real mail
  // going out. Only the exact string "true" enables it.
  LOG_EMAILS_INSTEAD_OF_SENDING: z.string().optional().transform((v) => v === "true"),
  // Where public walkthrough requests from the marketing site are delivered.
  // Defaulted rather than required so a deployment that has not set it still
  // boots and still captures leads, just to the default inbox.
  SALES_LEAD_EMAIL:        z.string().email().default("hello@innflo.co"),
  // ── WhatsApp Cloud API (nightly owner briefings) ─────────────────────────
  // Permanent system-user token from the Innflo business portfolio. Optional at
  // boot so a deployment with no WhatsApp set up still starts — sendWhatsappMessage
  // falls back to console logging when either this or the phone number ID is absent.
  WHATSAPP_ACCESS_TOKEN:    z.string().optional(),
  // The *phone number ID* from WhatsApp Manager, not the phone number itself.
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  // Pinned rather than tracking "latest": Meta retires a Graph version roughly two
  // years after release, and a silent bump can change response shapes mid-flight.
  WHATSAPP_API_VERSION:     z.string().default("v23.0"),
  // Must match an APPROVED template of category UTILITY in WhatsApp Manager. The
  // briefing is business-initiated, so a plain text send would be dropped.
  WHATSAPP_BRIEFING_TEMPLATE: z.string().default("nightly_briefing"),
  WHATSAPP_TEMPLATE_LANG:     z.string().default("en"),
  // Same reasoning as LOG_EMAILS_INSTEAD_OF_SENDING above — an explicit opt-in flag
  // rather than a NODE_ENV check, so no ambient misconfiguration can silently stop
  // real briefings going out. Only the exact string "true" enables it.
  LOG_WHATSAPP_INSTEAD_OF_SENDING: z.string().optional().transform((v) => v === "true"),
  // ── Channel manager (Channex) ────────────────────────────────────────────
  // Staging → production is a pure env swap; the URL is never hardcoded in the
  // service. Defaulted rather than required because the integration is inert
  // until a hotel is actually provisioned — a bare required string would fail
  // boot for every environment that has no interest in Channex yet.
  CHANNEX_BASE_URL:        z.string().url().default("https://staging.channex.io/api/v1"),
  // Account-level key: one key provisions many properties. A hotel may override
  // it with a property-scoped key in channel_configs.credentials.api_key.
  // Optional at boot — ChannexService reports a clean failure when it is absent
  // rather than taking the whole API down.
  CHANNEX_API_KEY:         z.string().optional(),
  // Channex webhooks carry no HMAC signature. Authentication is a shared secret
  // set in the webhook's `headers` at registration time. Optional here, but the
  // webhook route fails CLOSED when it is unset — see routes/webhooksChannex.ts.
  CHANNEX_WEBHOOK_SECRET:  z.string().optional(),
  // Per-property coalesce window: a burst of reservation activity on one hotel
  // collapses into a single ARI flush instead of N calls against a 10 req/min
  // per-property limit.
  CHANNEX_SYNC_DEBOUNCE_MS: z.coerce.number().int().min(0).default(6_000),
}).superRefine((val, ctx) => {
  if (val.NODE_ENV === "production" && !val.API_PUBLIC_URL) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["API_PUBLIC_URL"],
      message: "API_PUBLIC_URL is required in production (e.g. https://api.innflo.co) — " +
        "uploaded file URLs are unusable from any other origin without it.",
    });
  }
});

const parsedEnv = envSchema.parse(process.env);

export const env = {
  ...parsedEnv,
  // Dev-only fallback — production must set this explicitly (enforced above).
  API_PUBLIC_URL: parsedEnv.API_PUBLIC_URL ?? `http://localhost:${parsedEnv.PORT}`,
};
