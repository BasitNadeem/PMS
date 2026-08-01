/**
 * Creates birthday entries for guests who already have a date of birth on file.
 *
 * From now on `GuestService` derives the birthday whenever a date of birth is
 * captured, so this only needs to run once to cover guests registered before
 * that. Guests who already have a birthday entry are left alone — a
 * hand-corrected greeting date must survive.
 *
 * This records the date only. Nothing is emailed to anyone: sending still
 * requires the separate marketing opt-in, which this script never sets.
 *
 *   pnpm backfill:guest-birthdays -- --dry-run
 *   pnpm backfill:guest-birthdays
 */

import { Client } from "pg";

const SELECT_CANDIDATES = `
  SELECT g.id, g.hotel_id, g.date_of_birth
  FROM guests g
  WHERE g.deleted_at IS NULL
    AND g.date_of_birth IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM guest_special_dates s
      WHERE s.guest_id = g.id AND s.kind = 'BIRTHDAY'
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
    const { rows } = await client.query<{ id: string; hotel_id: string; date_of_birth: Date }>(SELECT_CANDIDATES);
    console.log(`Guests with a date of birth and no birthday entry: ${rows.length}`);

    if (dryRun) {
      console.log("\nDry run — no rows written.");
      return;
    }
    if (rows.length === 0) return;

    const result = await client.query(
      `INSERT INTO guest_special_dates (hotel_id, guest_id, kind, month, day, year, source, created_at, updated_at)
       SELECT g.hotel_id,
              g.id,
              'BIRTHDAY',
              EXTRACT(MONTH FROM g.date_of_birth)::int,
              EXTRACT(DAY   FROM g.date_of_birth)::int,
              EXTRACT(YEAR  FROM g.date_of_birth)::int,
              'DOCUMENT',
              NOW(),
              NOW()
       FROM (${SELECT_CANDIDATES}) g
       ON CONFLICT (guest_id, kind, month, day) DO NOTHING`,
    );

    console.log(`\n✅ Created ${result.rowCount} birthday entr(ies).`);
    console.log("   No emails were enabled — marketing consent is untouched.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("❌ Backfill failed:", err);
  process.exit(1);
});
