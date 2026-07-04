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
  CORS_ORIGIN:             z.string().url().default("http://localhost:5173"),
  ADMIN_CORS_ORIGIN:       z.string().url().default("http://localhost:5174"),
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
