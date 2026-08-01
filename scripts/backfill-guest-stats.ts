/**
 * Backfills guests.total_stays, guests.total_spend and guests.vip_level.
 *
 * These three columns have existed since the initial schema but nothing ever
 * wrote to them, so every guest reads 0. That silently broke the VIP badge on
 * the guest list, the stats row on the guest profile, and the Repeat Guests
 * report (which filters on total_stays and therefore always returned nothing).
 *
 * From now on ReservationService.updateStatus keeps these current on every
 * checkout — this script only needs to run once, to fix history.
 *
 * Runs against DIRECT_URL as a superuser so it bypasses RLS and can update
 * every hotel in one pass, same as apply-rls.ts.
 *
 *   pnpm backfill:guest-stats
 *   pnpm backfill:guest-stats -- --dry-run
 */

import { Client } from "pg";

// Keep in sync with DEFAULT_VIP_THRESHOLDS in apps/api/src/utils/guestStats.ts.
const VIP_THRESHOLDS: [number, number, number] = [3, 10, 20];

/**
 * Resolves each payment to at most one guest before aggregating. A payment can
 * carry both a reservation_id and a folio_id pointing at the same stay, so
 * summing the two links separately would double a guest's spend.
 */
const STATS_CTE = `
  WITH stays AS (
    SELECT id, guest_id
    FROM reservations
    WHERE status = 'CHECKED_OUT'
  ),
  payment_guest AS (
    SELECT
      p.id,
      p.amount,
      p.status,
      p.is_refund,
      COALESCE(direct.guest_id, via_folio.guest_id) AS guest_id
    FROM payments p
    LEFT JOIN stays  direct    ON p.reservation_id = direct.id
    LEFT JOIN folios f         ON p.folio_id       = f.id
    LEFT JOIN stays  via_folio ON f.reservation_id = via_folio.id
    WHERE direct.guest_id IS NOT NULL OR via_folio.guest_id IS NOT NULL
  ),
  spend AS (
    SELECT
      guest_id,
      GREATEST(0, COALESCE(SUM(
        CASE
          WHEN is_refund             THEN -amount
          WHEN status = 'COMPLETED'  THEN  amount
          ELSE 0
        END
      ), 0)) AS total_spend
    FROM payment_guest
    GROUP BY guest_id
  ),
  stay_counts AS (
    SELECT guest_id, COUNT(*)::int AS total_stays
    FROM stays
    GROUP BY guest_id
  ),
  computed AS (
    SELECT
      g.id,
      COALESCE(sc.total_stays, 0) AS total_stays,
      COALESCE(sp.total_spend, 0) AS total_spend,
      GREATEST(
        g.vip_level,
        CASE
          WHEN COALESCE(sc.total_stays, 0) >= $3 THEN 3
          WHEN COALESCE(sc.total_stays, 0) >= $2 THEN 2
          WHEN COALESCE(sc.total_stays, 0) >= $1 THEN 1
          ELSE 0
        END
      ) AS vip_level
    FROM guests g
    LEFT JOIN stay_counts sc ON sc.guest_id = g.id
    LEFT JOIN spend       sp ON sp.guest_id = g.id
    WHERE g.deleted_at IS NULL
  )
`;

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const directUrl = process.env.DIRECT_URL;
  if (!directUrl) {
    throw new Error("DIRECT_URL env var is required (must be a superuser connection)");
  }

  const client = new Client({ connectionString: directUrl });
  await client.connect();

  try {
    const preview = await client.query<{
      guests: string; with_stays: string; vip: string; total_spend: string;
    }>(
      `${STATS_CTE}
       SELECT
         COUNT(*)                                          AS guests,
         COUNT(*) FILTER (WHERE total_stays > 0)           AS with_stays,
         COUNT(*) FILTER (WHERE vip_level  > 0)            AS vip,
         COALESCE(SUM(total_spend), 0)                     AS total_spend
       FROM computed`,
      VIP_THRESHOLDS,
    );

    const row = preview.rows[0];
    console.log(`Guests scanned:          ${row?.guests ?? 0}`);
    console.log(`With completed stays:    ${row?.with_stays ?? 0}`);
    console.log(`Reaching a VIP level:    ${row?.vip ?? 0}`);
    console.log(`Total spend (PKR):       ${((Number(row?.total_spend ?? 0)) / 100).toLocaleString()}`);

    if (dryRun) {
      console.log("\nDry run — no rows written.");
      return;
    }

    const result = await client.query(
      `${STATS_CTE}
       UPDATE guests g
       SET total_stays = c.total_stays,
           total_spend = c.total_spend,
           vip_level   = c.vip_level
       FROM computed c
       WHERE g.id = c.id
         AND (g.total_stays, g.total_spend, g.vip_level)
             IS DISTINCT FROM (c.total_stays, c.total_spend, c.vip_level)`,
      VIP_THRESHOLDS,
    );

    console.log(`\n✅ Updated ${result.rowCount} guest row(s).`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("❌ Backfill failed:", err);
  process.exit(1);
});
