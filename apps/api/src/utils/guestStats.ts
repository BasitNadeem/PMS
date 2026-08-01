import type { TenantTx } from "@pms/db";
import { PaymentStatus, ReservationStatus } from "@pms/db";
import { parseVipThresholds, vipLevelForStays } from "./vipTiers";

export interface GuestStats {
  totalStays: number;
  totalSpend: number;
  vipLevel:   number;
}

/**
 * Recomputes a guest's lifetime stay count, spend and VIP level from source
 * records, then writes them back to the guest row.
 *
 * Deliberately a full recompute rather than an increment: checkout can be
 * reached more than once for the same guest (group checkout loops over every
 * member reservation, and a failed request may be retried), and an increment
 * would double-count. Recomputing is idempotent and self-healing, so a stat
 * that has drifted for any reason corrects itself at the next checkout.
 *
 * Must be called inside the same `withTenant` callback as the mutation that
 * triggered it so the stats commit atomically with the checkout.
 */
export async function recalculateGuestStats(db: TenantTx, guestId: string): Promise<GuestStats> {
  const guest = await db.guest.findUnique({
    where:  { id: guestId },
    select: { vipLevel: true, hotel: { select: { settings: true } } },
  });
  if (!guest) return { totalStays: 0, totalSpend: 0, vipLevel: 0 };

  // A stay only counts once the guest has actually left. Cancellations and
  // no-shows are excluded by definition, and an in-house guest is not yet a
  // completed stay.
  const stays = await db.reservation.findMany({
    where:  { guestId, status: ReservationStatus.CHECKED_OUT },
    select: { id: true, folio: { select: { id: true } } },
  });

  const reservationIds = stays.map((s) => s.id);
  const folioIds = stays.map((s) => s.folio?.id).filter((id): id is string => Boolean(id));

  let totalSpend = 0;
  if (reservationIds.length > 0) {
    // Payments reach a guest either directly (reservationId) or through the
    // folio, so match on both. A single payment row cannot satisfy both arms of
    // the OR twice, so there is no double-counting risk here.
    const paymentWhere = {
      OR: [
        { reservationId: { in: reservationIds } },
        ...(folioIds.length > 0 ? [{ folioId: { in: folioIds } }] : []),
      ],
    };

    const [collected, refunded] = await Promise.all([
      db.payment.aggregate({
        where: { ...paymentWhere, status: PaymentStatus.COMPLETED, isRefund: false },
        _sum:  { amount: true },
      }),
      db.payment.aggregate({
        where: { ...paymentWhere, isRefund: true },
        _sum:  { amount: true },
      }),
    ]);

    totalSpend = Math.max(0, (collected._sum.amount ?? 0) - (refunded._sum.amount ?? 0));
  }

  const totalStays = stays.length;
  const thresholds = parseVipThresholds(guest.hotel.settings);

  // Auto-tiering only ever promotes. A manager who hand-set a guest to VIP 3
  // keeps that decision, and nobody is silently demoted because a stay was
  // later refunded or corrected.
  const vipLevel = Math.max(guest.vipLevel, vipLevelForStays(totalStays, thresholds));

  await db.guest.update({
    where: { id: guestId },
    data:  { totalStays, totalSpend, vipLevel },
  });

  return { totalStays, totalSpend, vipLevel };
}
