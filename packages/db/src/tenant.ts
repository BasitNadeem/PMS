import { Prisma } from "@prisma/client";
import { prisma } from "./index";

/**
 * Transaction-scoped Prisma client passed to every route handler.
 * `SET LOCAL` means the session vars die when the transaction ends —
 * safe with any connection pool mode.
 */
export type TenantTx = Prisma.TransactionClient;

/**
 * Wraps fn in a Prisma interactive transaction that first sets the
 * PostgreSQL session variables required by every RLS policy:
 *
 *   app.current_hotel_id  →  isolates all hotel-scoped tables
 *   app.current_user_id   →  isolates the users table (self-access only)
 *
 * Usage:
 *   const rooms = await withTenant(hotelId, userId, (db) =>
 *     db.room.findMany({ where: { status: 'VACANT_CLEAN' } })
 *   );
 *
 * The transaction timeout is 30 s — enough for any single request, including
 * bulk operations. Raise it only for background jobs, not per-request handlers.
 */
export async function withTenant<T>(
  hotelId: string,
  userId: string,
  fn: (db: TenantTx) => Promise<T>
): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      // set_config(key, value, is_local=true) ≡ SET LOCAL — scoped to this tx
      await tx.$executeRaw`SELECT set_config('app.current_hotel_id', ${hotelId}, true)`;
      await tx.$executeRaw`SELECT set_config('app.current_user_id',  ${userId},  true)`;
      return fn(tx);
    },
    { timeout: 30_000 }
  );
}
