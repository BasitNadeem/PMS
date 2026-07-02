#!/bin/bash
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

log()     { echo -e "${BLUE}▶${NC}  $1"; }
success() { echo -e "${GREEN}✓${NC}  $1"; }
warn()    { echo -e "${YELLOW}⚠${NC}  $1"; }
error()   { echo -e "${RED}✗${NC}  $1"; exit 1; }

cd "$(dirname "$0")/.."

echo ""
echo "🏨  Hotel PMS — Fresh Machine Setup"
echo "════════════════════════════════════════"
echo ""

# ── STEP 1: Dependencies ───────────────────────────────
log "Installing dependencies..."
pnpm install || error "pnpm install failed. Check Node/pnpm version."
success "Dependencies installed"

# ── STEP 2: Docker ─────────────────────────────────────
log "Starting Docker containers..."
# Remove any existing containers that might conflict
docker rm -f pms_postgres pms_redis 2>/dev/null || true
docker compose up -d \
  || error "Docker failed. Is Docker Desktop running?"
success "Containers starting..."

# ── STEP 3: Wait for Postgres ──────────────────────────
log "Waiting for Postgres to be healthy..."
TIMEOUT=60; ELAPSED=0
until docker inspect pms_postgres \
  --format='{{.State.Health.Status}}' 2>/dev/null \
  | grep -q "^healthy$"; do
  if [ $ELAPSED -ge $TIMEOUT ]; then
    error "Postgres not healthy after ${TIMEOUT}s.
    Check: docker logs pms_postgres"
  fi
  printf "."
  sleep 1; ELAPSED=$((ELAPSED + 1))
done
echo ""
success "Postgres healthy (${ELAPSED}s)"

# ── STEP 4: Wait for Redis ─────────────────────────────
log "Waiting for Redis to be healthy..."
TIMEOUT=30; ELAPSED=0
until docker inspect pms_redis \
  --format='{{.State.Health.Status}}' 2>/dev/null \
  | grep -q "^healthy$"; do
  if [ $ELAPSED -ge $TIMEOUT ]; then
    warn "Redis not healthy after ${TIMEOUT}s — continuing"
    break
  fi
  printf "."; sleep 1; ELAPSED=$((ELAPSED + 1))
done
echo ""
success "Redis ready"

# ── STEP 5: Create app DB role ─────────────────────────
log "Creating database role..."
docker exec pms_postgres psql -U pms_user -d hotel_pms -c "
DO \$\$
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_roles WHERE rolname = 'hotel_pms_app'
  ) THEN
    CREATE ROLE hotel_pms_app
      WITH LOGIN PASSWORD 'pms_app_dev_pass';
  END IF;
END
\$\$;
GRANT CONNECT ON DATABASE hotel_pms TO hotel_pms_app;
GRANT USAGE ON SCHEMA public TO hotel_pms_app;
" || error "Failed to create database role"
success "Database role ready"

# ── STEP 6: Generate Prisma client ─────────────────────
log "Generating Prisma client..."
pnpm db:generate \
  || error "Prisma generate failed"
success "Prisma client generated"

# ── STEP 7: Clean up stuck migrations ─────────────────
log "Cleaning up stuck migrations from previous attempts..."
docker exec pms_postgres psql -U pms_user -d hotel_pms -c "
DELETE FROM _prisma_migrations
WHERE finished_at IS NULL
AND rolled_back_at IS NULL
AND started_at < NOW() - INTERVAL '5 minutes';
" 2>/dev/null || true
success "Migration history clean"

# ── STEP 8: Run migrations ─────────────────────────────
log "Applying database migrations..."
MIGRATE_EXIT=0
pnpm db:migrate:deploy || MIGRATE_EXIT=$?

if [ $MIGRATE_EXIT -ne 0 ]; then
  FAILED_MIG=$(docker exec pms_postgres psql -U pms_user -d hotel_pms -tAc \
    "SELECT migration_name FROM _prisma_migrations
     WHERE finished_at IS NULL AND rolled_back_at IS NULL
     ORDER BY started_at DESC LIMIT 1;" 2>/dev/null || echo "unknown")
  error "Migration failed: ${FAILED_MIG:-unknown}
  Fix: pnpm docker:reset && pnpm fresh-setup
  NEVER run: prisma migrate resolve --applied"
fi
success "All migrations applied"

# ── STEP 9: Apply RLS + triggers ───────────────────────
log "Applying RLS policies and triggers..."
pnpm apply:rls \
  || error "apply:rls failed. Check rls_and_triggers.sql"
success "RLS and triggers applied"

# ── STEP 10: Seed database ─────────────────────────────
log "Seeding database..."
pnpm db:seed \
  || error "Seed failed. Check packages/db/src/seed.ts"
success "Database seeded"

# ── STEP 11: Verify ────────────────────────────────────
log "Running verification..."

EXPECTED_TABLES=(
  # Core Prisma tables
  hotels users roles permissions role_permissions hotel_users
  room_types rooms
  guests guest_blacklist
  reservations reservation_rooms
  group_bookings group_members
  folios folio_items folio_splits
  payments invoices
  pos_categories pos_items pos_orders pos_order_items
  housekeeping_tasks
  maintenance_tickets
  inventory_items inventory_transactions
  conversations messages
  rate_plans rate_plan_items
  channel_configs
  staff shift_reports
  tax_configs
  audit_logs notifications
  custom_field_definitions custom_field_values
  # Raw-SQL tables
  front_desk_notes
  push_subscriptions
  expenses
  whatsapp_briefing_logs
  cash_accounts ledger_entries
  menu_categories menu_items
  qr_orders qr_order_items
)

MISSING=0
for table in "${EXPECTED_TABLES[@]}"; do
  EXISTS=$(docker exec pms_postgres psql \
    -U pms_user -d hotel_pms -t -c \
    "SELECT COUNT(*) FROM pg_tables
     WHERE schemaname='public'
     AND tablename='$table';" | tr -d ' \n')
  if [ "$EXISTS" = "0" ]; then
    warn "MISSING TABLE: $table"
    MISSING=$((MISSING + 1))
  fi
done

if [ $MISSING -gt 0 ]; then
  error "$MISSING tables are missing.
  Run 'pnpm verify-db' for full report.
  This means a migration file is incomplete.
  Fix the migration SQL and run:
  pnpm docker:reset && pnpm fresh-setup"
fi
success "All ${#EXPECTED_TABLES[@]} tables verified"

# Verify RLS on core tables
RLS_OFF=$(docker exec pms_postgres psql \
  -U pms_user -d hotel_pms -t -c "
  SELECT COUNT(*) FROM pg_class c
  JOIN pg_tables t ON t.tablename = c.relname
  WHERE t.schemaname = 'public'
  AND c.relrowsecurity = false
  AND t.tablename = ANY(ARRAY[
    'hotels','reservations','rooms','guests',
    'folios','payments','housekeeping_tasks',
    'maintenance_tickets','notifications'
  ]);" | tr -d ' \n')

if [ "$RLS_OFF" -gt "0" ]; then
  warn "RLS off on $RLS_OFF tables — re-running apply:rls"
  pnpm apply:rls
else
  success "RLS verified on all core tables"
fi

# Verify app role can connect
CONN=$(docker exec pms_postgres psql \
  -U hotel_pms_app -d hotel_pms -c "SELECT 1;" \
  2>/dev/null | grep -c "1 row" || echo "0")
if [ "$CONN" != "1" ]; then
  error "hotel_pms_app role cannot connect to DB.
  Run: pnpm apply:rls (refreshes grants)"
fi
success "App role connection verified"

# ── DONE ───────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════"
echo -e "${GREEN}✅  Setup complete!${NC}"
echo "════════════════════════════════════════"
echo ""
echo "  Credentials:"
echo "  ┌──────────────────────────────────────┐"
echo "  │  Hotel App (localhost:5173)           │"
echo "  │  Slug    : demo-hotel                │"
echo "  │  Email   : admin@demo-hotel.com      │"
echo "  │  Password: Admin1234!                │"
echo "  ├──────────────────────────────────────┤"
echo "  │  Admin Panel (localhost:5174)         │"
echo "  │  Email   : admin@yourpms.com         │"
echo "  │  Password: AdminPass123!             │"
echo "  └──────────────────────────────────────┘"
echo ""
echo "  Commands:"
echo "  pnpm dev        → start all apps"
echo "  pnpm verify-db  → check DB health"
echo ""
