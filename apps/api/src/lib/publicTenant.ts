import { withTenant } from "@pms/db";
import type { TenantTx } from "@pms/db";

// Sentinel used for hotel-scoped public operations.
// RLS hotel tables filter only on app.current_hotel_id; app.current_user_id is
// only enforced on the hotel_users table, which public routes never touch.
const PUBLIC_SENTINEL_USER = "00000000-0000-0000-0000-000000000000";

export type PublicWithTenant = <T>(fn: (db: TenantTx) => Promise<T>) => Promise<T>;

export function publicWithTenant(hotelId: string): PublicWithTenant {
  return <T>(fn: (db: TenantTx) => Promise<T>) =>
    withTenant(hotelId, PUBLIC_SENTINEL_USER, fn);
}
