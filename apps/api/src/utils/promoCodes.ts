import type { TenantTx } from "@pms/db";
import { AppError } from "./AppError";

/** Personal offers may only be redeemed by the guest they were issued to. */
export async function assertPromoCodeGuest(
  db: TenantTx,
  hotelId: string,
  code: string,
  guestId: string,
): Promise<void> {
  const promo = await db.ratePlanCode.findFirst({
    where: { hotelId, code, isActive: true },
    select: { guestId: true },
  });
  if (!promo) throw new AppError(400, "Promo or corporate code is invalid or unavailable");
  if (promo.guestId && promo.guestId !== guestId) {
    throw new AppError(403, "This personal offer was issued to a different guest");
  }
}

/**
 * Marks one use of a promo code, refusing to go past its limit.
 *
 * A single atomic UPDATE rather than read-then-write: two guests submitting the
 * same single-use code at the same moment would both pass a separate read check
 * and both book. The `used_count < max_uses` predicate lives inside the write,
 * so exactly one of them wins.
 *
 * Codes with a null `max_uses` — every shared corporate/promo code that existed
 * before per-guest issuance — are unlimited and always succeed.
 *
 * Returns false when the code was already exhausted. Callers treat that as
 * "the code is no longer valid" rather than failing the whole booking, since
 * the reservation itself is legitimate.
 */
export async function consumePromoCode(
  db: TenantTx,
  hotelId: string,
  code: string,
): Promise<boolean> {
  const updated = await db.$executeRaw`
    UPDATE rate_plan_codes
       SET used_count   = used_count + 1,
           last_used_at = NOW()
     WHERE hotel_id  = ${hotelId}::uuid
       AND code      = ${code}
       AND is_active = TRUE
       AND (valid_from IS NULL OR valid_from <= (NOW() AT TIME ZONE 'Asia/Karachi')::date)
       AND (valid_to   IS NULL OR valid_to   >= (NOW() AT TIME ZONE 'Asia/Karachi')::date)
       AND (max_uses IS NULL OR used_count < max_uses)
  `;
  return updated > 0;
}
