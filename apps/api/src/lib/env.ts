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
});

export const env = envSchema.parse(process.env);
