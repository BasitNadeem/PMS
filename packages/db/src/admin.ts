import { PrismaClient } from "@prisma/client";

/**
 * Admin Prisma client — connects via DIRECT_URL (pms_user superuser).
 *
 * Superusers bypass all RLS policies. Use ONLY for:
 *   - Login / token refresh  (no hotel context established yet)
 *   - Hotel onboarding       (creating the tenant record itself)
 *   - Background jobs        (cross-tenant aggregations, billing)
 *   - Seed / migration scripts
 *
 * NEVER expose this client to request handlers that act on behalf of a
 * logged-in user — those must go through withTenant().
 */
declare global {
  // eslint-disable-next-line no-var
  var __adminPrisma: PrismaClient | undefined;
}

export const adminPrisma =
  global.__adminPrisma ??
  new PrismaClient({
    datasources: {
      db: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL },
    },
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.__adminPrisma = adminPrisma;
}
