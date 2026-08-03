/**
 * Adds the COMPANY_* / companies:* permissions and grants them to the system
 * roles that should hold them.
 *
 * `pnpm db:seed` would also do this, but it delete-then-recreates every
 * role→permission row for the system roles, which would silently reset any
 * permission a hotel had customised in Settings. This script is purely
 * additive: it inserts the new permission rows and the new grants, and touches
 * nothing that already exists.
 *
 * Runs against DIRECT_URL as a superuser so it bypasses RLS, same as
 * apply-rls.ts. Safe to re-run.
 *
 *   pnpm perms:companies
 *   pnpm perms:companies -- --dry-run
 */

import { Client } from "pg";

interface PermissionRow {
  key: string;
  module: string;
  action: string;
  displayName: string;
}

// Must stay in sync with ALL_PERMISSIONS / MODULE_PERMISSIONS in
// packages/db/src/seed.ts.
const PERMISSIONS: PermissionRow[] = [
  { key: "COMPANY_READ",         module: "company",   action: "read",     displayName: "View Companies" },
  { key: "COMPANY_CREATE",       module: "company",   action: "create",   displayName: "Create Companies" },
  { key: "COMPANY_UPDATE",       module: "company",   action: "update",   displayName: "Edit Companies" },
  { key: "COMPANY_DELETE",       module: "company",   action: "delete",   displayName: "Delete Companies" },
  { key: "COMPANY_CREDIT_LIMIT", module: "company",   action: "limit",    displayName: "Set Company Credit Limits" },
  { key: "COMPANY_LEDGER_POST",  module: "company",   action: "post",     displayName: "Bill Folios to Company Credit" },
  { key: "COMPANY_PAYMENT",      module: "company",   action: "payment",  displayName: "Record Company Payments" },
  { key: "COMPANY_WRITE_OFF",    module: "company",   action: "writeoff", displayName: "Write Off Company Debt" },
  { key: "COMPANY_INVOICE",      module: "company",   action: "invoice",  displayName: "Issue Company Invoices" },

  { key: "companies:read",        module: "companies", action: "read",        displayName: "Read Companies" },
  { key: "companies:create",      module: "companies", action: "create",      displayName: "Create Companies" },
  { key: "companies:update",      module: "companies", action: "update",      displayName: "Update Companies" },
  { key: "companies:delete",      module: "companies", action: "delete",      displayName: "Delete Companies" },
  { key: "companies:creditLimit", module: "companies", action: "creditLimit", displayName: "Set Company Credit Limits" },
  { key: "companies:post",        module: "companies", action: "post",        displayName: "Bill Folios to Company Credit" },
  { key: "companies:payment",     module: "companies", action: "payment",     displayName: "Record Company Payments" },
  { key: "companies:writeOff",    module: "companies", action: "writeOff",    displayName: "Write Off Company Debt" },
  { key: "companies:invoice",     module: "companies", action: "invoice",     displayName: "Issue Company Invoices" },
];

const GRANTS: Record<string, string[]> = {
  OWNER: PERMISSIONS.map((p) => p.key),

  // Everything except the menu-level delete toggle, matching how MANAGER is
  // granted every other module in seed.ts (no guests:delete either).
  MANAGER: PERMISSIONS.map((p) => p.key).filter((k) => k !== "companies:delete"),

  // Reception books agency guests and settles them at checkout, but cannot
  // create companies, move credit limits, or write debt off.
  FRONT_DESK: ["COMPANY_READ", "COMPANY_LEDGER_POST", "companies:read", "companies:post"],

  ACCOUNTANT: [
    "COMPANY_READ", "COMPANY_CREATE", "COMPANY_UPDATE",
    "COMPANY_LEDGER_POST", "COMPANY_PAYMENT", "COMPANY_INVOICE",
    "companies:read", "companies:create", "companies:update",
    "companies:post", "companies:payment", "companies:invoice",
  ],
};

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Neither DIRECT_URL nor DATABASE_URL is set.");
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    await client.query("BEGIN");

    let inserted = 0;
    for (const p of PERMISSIONS) {
      const res = await client.query(
        `INSERT INTO permissions (id, key, module, action, display_name)
         VALUES (gen_random_uuid(), $1, $2, $3, $4)
         ON CONFLICT (key) DO NOTHING`,
        [p.key, p.module, p.action, p.displayName],
      );
      inserted += res.rowCount ?? 0;
    }
    console.log(`  permissions: ${inserted} added, ${PERMISSIONS.length - inserted} already present`);

    let granted = 0;
    for (const [roleName, keys] of Object.entries(GRANTS)) {
      // System roles only (hotel_id IS NULL). Custom per-hotel roles are left
      // alone — whoever created them decides what they can do.
      const res = await client.query(
        `INSERT INTO role_permissions (id, role_id, permission_id)
         SELECT gen_random_uuid(), r.id, p.id
         FROM roles r
         CROSS JOIN permissions p
         WHERE r.name = $1 AND r.hotel_id IS NULL AND p.key = ANY($2)
         ON CONFLICT (role_id, permission_id) DO NOTHING`,
        [roleName, keys],
      );
      granted += res.rowCount ?? 0;
      console.log(`  ${roleName}: +${res.rowCount ?? 0} grant(s)`);
    }

    if (dryRun) {
      await client.query("ROLLBACK");
      console.log(`\n🔍  Dry run — rolled back. Would have added ${inserted} permission(s) and ${granted} grant(s).`);
    } else {
      await client.query("COMMIT");
      console.log(`\n✅  Added ${inserted} permission(s) and ${granted} grant(s).`);
      console.log("    Staff must sign out and back in — permissions are baked into the JWT.");
    }
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("❌  Failed:", err);
  process.exit(1);
});
