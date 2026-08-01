#!/bin/bash
# verify-db.sh — complete health report: every expected table, RLS status,
# migration history, and app-role connectivity.
# Run any time to inspect the current state without re-running setup.
set -uo pipefail
cd "$(dirname "$0")/.."

echo ""
echo "🔍 Database Verification Report"
echo "════════════════════════════════════════"

if ! docker exec pms_postgres pg_isready -U pms_user -d hotel_pms >/dev/null 2>&1; then
  echo "❌  Postgres is not reachable (container 'pms_postgres' not running?)"
  exit 1
fi

check_table() {
  local table="$1"
  docker exec pms_postgres psql -U pms_user -d hotel_pms -tAc \
    "SELECT 1 FROM information_schema.tables
     WHERE table_schema='public' AND table_name='$table'"
}

check_rls() {
  local table="$1"
  docker exec pms_postgres psql -U pms_user -d hotel_pms -tAc \
    "SELECT c.relrowsecurity
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname='public' AND c.relname='$table'"
}

# ── Core Prisma tables (RLS expected) ──────────────────────────────────────────
echo ""
echo "── Core tables (RLS expected) ──"
CORE_TABLES="hotels users roles permissions role_permissions hotel_users \
room_types rooms guests guest_blacklist guest_special_dates \
reservations reservation_rooms group_bookings group_members \
folios folio_items folio_splits payments invoices \
pos_categories pos_items pos_orders pos_order_items \
housekeeping_tasks maintenance_tickets \
inventory_items inventory_transactions \
conversations messages \
rate_plans rate_plan_items rate_plan_codes channel_configs \
staff shift_reports tax_configs \
audit_logs notifications \
custom_field_definitions custom_field_values \
night_audit_records"

for t in $CORE_TABLES; do
  EXISTS=$(check_table "$t")
  if [ "$EXISTS" != "1" ]; then
    echo "  ❌ MISSING          $t"
    continue
  fi
  RLS=$(check_rls "$t")
  if [ "$RLS" = "t" ]; then
    echo "  ✅ exists, RLS on   $t"
  else
    echo "  ⚠️  exists, RLS OFF  $t"
  fi
done

# ── Financial tables (RLS intentionally OFF — accessed via adminPrisma) ────────
echo ""
echo "── Financial tables (RLS intentionally off) ──"
FINANCIAL_TABLES="expenses cash_accounts ledger_entries whatsapp_briefing_logs"
for t in $FINANCIAL_TABLES; do
  EXISTS=$(check_table "$t")
  if [ "$EXISTS" = "1" ]; then
    echo "  ✅ exists           $t"
  else
    echo "  ❌ MISSING          $t"
  fi
done

# ── Front-desk & push tables ───────────────────────────────────────────────────
echo ""
echo "── Operational tables ──"
OP_TABLES="front_desk_notes push_subscriptions"
for t in $OP_TABLES; do
  EXISTS=$(check_table "$t")
  RLS=$(check_rls "$t")
  if [ "$EXISTS" != "1" ]; then
    echo "  ❌ MISSING          $t"
  elif [ "$RLS" = "t" ]; then
    echo "  ✅ exists, RLS on   $t"
  else
    echo "  ⚠️  exists, RLS OFF  $t"
  fi
done

# ── Admin/Platform tables (no RLS — global, not hotel-scoped) ─────────────────
echo ""
echo "── Admin/Platform tables (no RLS — global, not hotel-scoped) ──"
PLATFORM_TABLES="subscription_plans"
for t in $PLATFORM_TABLES; do
  EXISTS=$(check_table "$t")
  if [ "$EXISTS" = "1" ]; then
    echo "  ✅ exists           $t"
  else
    echo "  ❌ MISSING          $t"
  fi
done

# ── QR & Menu tables (RLS intentionally off) ──────────────────────────────────
echo ""
echo "── QR & Menu tables (RLS intentionally off) ──"
QR_TABLES="menu_categories menu_items qr_orders qr_order_items"
for t in $QR_TABLES; do
  EXISTS=$(check_table "$t")
  if [ "$EXISTS" = "1" ]; then
    echo "  ✅ exists           $t"
  else
    echo "  ❌ MISSING          $t"
  fi
done

# ── Critical column checks ─────────────────────────────────────────────────────
echo ""
echo "── Critical column checks ──"

check_col() {
  local table="$1" col="$2"
  docker exec pms_postgres psql -U pms_user -d hotel_pms -tAc \
    "SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='$table' AND column_name='$col'"
}

for col in payment_preference requires_folio_review; do
  if [ "$(check_col qr_orders $col)" = "1" ]; then
    echo "  ✅ qr_orders.$col"
  else
    echo "  ❌ MISSING  qr_orders.$col"
  fi
done
for col in is_qr_visible available_from available_until; do
  if [ "$(check_col pos_categories $col)" = "1" ]; then
    echo "  ✅ pos_categories.$col"
  else
    echo "  ❌ MISSING  pos_categories.$col"
  fi
done
for col in is_qr_visible is_featured; do
  if [ "$(check_col pos_items $col)" = "1" ]; then
    echo "  ✅ pos_items.$col"
  else
    echo "  ❌ MISSING  pos_items.$col"
  fi
done
for col in booking_contact_name; do
  if [ "$(check_col reservations $col)" = "1" ]; then
    echo "  ✅ reservations.$col"
  else
    echo "  ❌ MISSING  reservations.$col"
  fi
done
for col in subdomain onboarding_completed onboarding_step subscription_plan_id limit_overrides feature_overrides description amenities; do
  if [ "$(check_col hotels $col)" = "1" ]; then
    echo "  ✅ hotels.$col"
  else
    echo "  ❌ MISSING  hotels.$col"
  fi
done
for col in guest_id discount_percent email_status email_sent_at email_error; do
  if [ "$(check_col rate_plan_codes $col)" = "1" ]; then
    echo "  ✅ rate_plan_codes.$col"
  else
    echo "  ❌ MISSING  rate_plan_codes.$col"
  fi
done
for col in features limits is_active; do
  if [ "$(check_col subscription_plans $col)" = "1" ]; then
    echo "  ✅ subscription_plans.$col"
  else
    echo "  ❌ MISSING  subscription_plans.$col"
  fi
done
for col in is_super_admin is_first_login; do
  if [ "$(check_col users $col)" = "1" ]; then
    echo "  ✅ users.$col"
  else
    echo "  ❌ MISSING  users.$col"
  fi
done

# ── Migration history ──────────────────────────────────────────────────────────
echo ""
echo "── Migration history ──"
docker exec pms_postgres psql -U pms_user -d hotel_pms -c \
  "SELECT migration_name,
          finished_at IS NOT NULL AS finished,
          rolled_back_at IS NOT NULL AS rolled_back
   FROM _prisma_migrations
   ORDER BY started_at ASC;" \
  2>/dev/null || echo "  No migration history found (_prisma_migrations table missing)."

# ── App-role login check ───────────────────────────────────────────────────────
echo ""
echo "── App-role connection check ──"
APP_PASSWORD="${DB_APP_PASSWORD:-pms_app_dev_pass}"
if docker exec -e PGPASSWORD="$APP_PASSWORD" pms_postgres \
  psql -U hotel_pms_app -d hotel_pms -tAc "SELECT 1" >/dev/null 2>&1; then
  echo "  ✅ hotel_pms_app role can connect"
else
  echo "  ❌ hotel_pms_app role cannot connect — run 'pnpm apply:rls'"
fi
echo ""
