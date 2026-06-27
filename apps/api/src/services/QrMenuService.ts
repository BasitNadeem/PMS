/**
 * QrMenuService — guest-facing QR menu reads.
 *
 * The QR menu and the POS menu are the same underlying data (PosCategory /
 * PosItem) — there is no separate menu to manage. A category/item's
 * `isQrVisible` flag controls whether it appears here, independently of
 * `isActive`/`isAvailable` (which control POS terminal visibility). Staff
 * manage both from the POS "Menu Setup" screen.
 *
 * Uses adminPrisma because public guest endpoints have no authenticated user
 * and therefore no withTenant context (same pattern as QrOrderService).
 */

import { adminPrisma } from "@pms/db";

function isWithinTimeWindow(from: string | null, until: string | null): boolean {
  if (!from && !until) return true;
  const now = new Date();
  const nowHHMM = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  if (from && nowHHMM < from) return false;
  if (until && nowHHMM > until) return false;
  return true;
}

export const QrMenuService = {
  // ── Public menu (QR-visible items only, respects time windows) ─────────────

  async getPublicMenu(hotelId: string) {
    const categories = await adminPrisma.posCategory.findMany({
      where: { hotelId, isQrVisible: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        items: {
          // isQrVisible alone gates QR visibility — independent of isAvailable
          // (POS terminal sellability), by design: the two channels can differ.
          where: { hotelId, isQrVisible: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        },
      },
    });

    return categories
      .filter((cat) => isWithinTimeWindow(cat.availableFrom, cat.availableUntil))
      .map((cat) => ({
        id:             cat.id,
        name:           cat.name,
        description:    null as string | null, // PosCategory has no description field
        displayOrder:   cat.sortOrder,
        availableFrom:  cat.availableFrom,
        availableUntil: cat.availableUntil,
        items: cat.items.map((i) => ({
          id:           i.id,
          name:         i.name,
          description:  i.description,
          price:        i.price,
          imageUrl:     i.photoUrl,
          isFeatured:   i.isFeatured,
          displayOrder: i.sortOrder,
        })),
      }));
  },

  // ── Validation helper used by QrOrderService ───────────────────────────────

  async getItemsByIds(hotelId: string, ids: string[]) {
    if (ids.length === 0) return [];
    return adminPrisma.posItem.findMany({
      where: { hotelId, id: { in: ids } },
      select: { id: true, name: true, price: true, isAvailable: true, isQrVisible: true },
    });
  },
};
