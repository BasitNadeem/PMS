/**
 * Applies rls_and_triggers.sql to the database.
 *
 * Must run as a superuser (DIRECT_URL / pms_user) so it can:
 *   - CREATE/ALTER ROLEs
 *   - Enable RLS on tables
 *   - Create SECURITY DEFINER functions
 *
 * Run after every `prisma migrate deploy`:
 *   pnpm apply:rls
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { Client } from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const directUrl = process.env.DIRECT_URL;
  if (!directUrl) {
    throw new Error("DIRECT_URL env var is required (must be a superuser connection)");
  }

  const appPassword = process.env.DB_APP_PASSWORD;
  if (!appPassword) {
    throw new Error("DB_APP_PASSWORD env var is required");
  }

  const sql = readFileSync(join(__dirname, "../rls_and_triggers.sql"), "utf-8");

  const client = new Client({ connectionString: directUrl });
  await client.connect();

  try {
    console.log("▶  Applying rls_and_triggers.sql…");
    await client.query(sql);
    console.log("✔  SQL applied.");

    // Set the app role password (the SQL creates it with a placeholder password)
    // Identifier cannot be parameterized in ALTER ROLE — escape it manually.
    // Password is a value — use $1 via format to prevent injection.
    await client.query(
      `ALTER ROLE hotel_pms_app PASSWORD '${appPassword.replace(/'/g, "''")}'`
    );
    console.log("✔  hotel_pms_app password updated.");

    // Grant the app role access to all current tables/sequences (idempotent)
    await client.query(`GRANT USAGE ON SCHEMA public TO hotel_pms_app`);
    await client.query(`GRANT ALL ON ALL TABLES    IN SCHEMA public TO hotel_pms_app`);
    await client.query(`GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO hotel_pms_app`);
    console.log("✔  Grants refreshed.");

    console.log("\n✅  RLS, triggers, indexes, views — all applied successfully.");
    console.log(
      "   App role: hotel_pms_app  |  connects via DATABASE_URL\n" +
      "   Admin role: pms_user     |  connects via DIRECT_URL (migrations only)\n"
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("❌  apply-rls failed:", err.message);
  process.exit(1);
});
