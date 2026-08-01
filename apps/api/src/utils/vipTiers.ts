/**
 * Recognition-tier rules, kept free of any `@pms/db` import so the logic can be
 * unit-tested without a database connection.
 */

// Stay count required to reach VIP level 1, 2 and 3. A hotel can override these
// via `settings.vipThresholds`; the defaults suit a small property where a third
// visit already makes someone a familiar face.
export const DEFAULT_VIP_THRESHOLDS: readonly [number, number, number] = [3, 10, 20];

export type VipThresholds = readonly [number, number, number];

/**
 * Reads per-hotel thresholds out of the `settings` JSON blob, falling back to
 * the defaults whenever the stored value is missing or malformed — a bad
 * setting must not stop a checkout from completing.
 */
export function parseVipThresholds(settings: unknown): VipThresholds {
  const raw = (settings as Record<string, unknown> | null)?.vipThresholds;
  if (!Array.isArray(raw) || raw.length !== 3) return DEFAULT_VIP_THRESHOLDS;

  const parsed = raw.map((v) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : null));
  if (parsed.some((v) => v === null)) return DEFAULT_VIP_THRESHOLDS;

  const [one, two, three] = parsed as [number, number, number];
  // Non-ascending thresholds would make a higher tier easier to reach than a
  // lower one, so fall back rather than compute a nonsensical level.
  if (!(one < two && two < three)) return DEFAULT_VIP_THRESHOLDS;
  return [one, two, three];
}

export function vipLevelForStays(
  stays: number,
  thresholds: VipThresholds = DEFAULT_VIP_THRESHOLDS,
): number {
  if (stays >= thresholds[2]) return 3;
  if (stays >= thresholds[1]) return 2;
  if (stays >= thresholds[0]) return 1;
  return 0;
}
