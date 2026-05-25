import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

/**
 * App Prisma client — connects via DATABASE_URL (hotel_pms_app role).
 * This role is subject to RLS. Every query MUST run inside withTenant()
 * or the RLS policies will block it with empty results.
 */
export const prisma =
  global.__prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}

export * from "@prisma/client";
export { withTenant } from "./tenant";
export type { TenantTx } from "./tenant";
export { adminPrisma } from "./admin";
