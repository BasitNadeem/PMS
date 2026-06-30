#!/bin/bash
# verify-db.sh — quick sanity report: does every expected table exist, and
# is RLS enabled where it should be? Run after setup, or any time something
# feels off, to see the actual state instead of guessing.
set -uo pipefail
cd "$(dirname "$0")/.."

echo ""
echo "🔍 Database Verification Report"
echo "════════════════════════════════"

if ! docker exec pms_postgres pg_isready -U pms_user -d hotel_pms >/dev/null 2>&1; then
  echo "❌  Postgres is not reachable (container 'pms_postgres' not running?)"
  exit 1
fi

# Tables managed by Prisma migrations (RLS expected via enable_hotel_rls())
PRISMA_TABLES="hotels users rooms room_types reservations guests folios payments \
housekeeping_tasks maintenance_tickets push_subscriptions front_desk_notes \
inventory_items inventory_transactions group_bookings notifications audit_logs \
roles permissions hotel_users"

# Raw-SQL tables (not in schema.prisma; accessed via adminPrisma + manual
# hotel_id filtering, so RLS is intentionally not enabled on these — see
# the header comment in ExpenseService.ts / CashBookService.ts).
RAW_SQL_TABLES="expenses cash_accounts ledger_entries whatsapp_briefing_logs"

echo ""
echo "── Prisma-managed tables (RLS expected) ──"
for t in $PRISMA_TABLES; do
  EXISTS=$(docker exec pms_postgres psql -U pms_user -d hotel_pms -tAc \
    "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='$t'")
  if [ "$EXISTS" != "1" ]; then
    echo "  ❌ MISSING        $t"
    continue
  fi
  RLS=$(docker exec pms_postgres psql -U pms_user -d hotel_pms -tAc \
    "SELECT relrowsecurity FROM pg_class WHERE relname='$t'")
  if [ "$RLS" = "t" ]; then
    echo "  ✅ exists, RLS on  $t"
  else
    echo "  ⚠️  exists, RLS OFF $t"
  fi
done

echo ""
echo "── Raw-SQL tables (RLS intentionally off — accessed via adminPrisma) ──"
for t in $RAW_SQL_TABLES; do
  EXISTS=$(docker exec pms_postgres psql -U pms_user -d hotel_pms -tAc \
    "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='$t'")
  if [ "$EXISTS" = "1" ]; then
    echo "  ✅ exists          $t"
  else
    echo "  ❌ MISSING        $t"
  fi
done

echo ""
echo "── Migration history ──"
docker exec pms_postgres psql -U pms_user -d hotel_pms -c \
  "SELECT migration_name, finished_at IS NOT NULL AS finished, rolled_back_at IS NOT NULL AS rolled_back FROM _prisma_migrations ORDER BY started_at ASC;" \
  2>/dev/null || echo "  No migration history found (_prisma_migrations table missing)."

echo ""
echo "── App-role login check ──"
APP_PASSWORD="${DB_APP_PASSWORD:-pms_app_dev_pass}"
if docker exec -e PGPASSWORD="$APP_PASSWORD" pms_postgres \
  psql -U hotel_pms_app -d hotel_pms -tAc "SELECT 1" >/dev/null 2>&1; then
  echo "  ✅ hotel_pms_app role can connect"
else
  echo "  ❌ hotel_pms_app role cannot connect — run 'pnpm apply:rls'"
fi
echo ""
