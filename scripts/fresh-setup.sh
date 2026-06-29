#!/bin/bash
# fresh-setup.sh — one-command first-time setup for a brand new machine.
#
# This is a thin wrapper around `pnpm setup`, which already runs the steps
# in the CORRECT order:
#   pnpm docker:up && pnpm db:migrate && pnpm apply:rls && pnpm db:generate && pnpm db:seed
#
# Why order matters: `db:migrate` creates the actual tables. `apply:rls`
# only adds Row-Level Security policies and triggers ON TOP OF tables that
# already exist — running it first (or before migrate has finished) fails,
# or worse, leaves you tempted to "fix" a migrate prompt by hand, which is
# exactly what causes tables to silently go missing (see warning below).
#
# What this wrapper adds on top of `pnpm setup`:
#   - Waits for Postgres to actually be healthy before running anything,
#     instead of a blind `sleep 3` (slow machines / first-ever image pull
#     can take longer than 3 seconds).
#   - Fails loudly with a clear, specific message instead of leaving you
#     to puzzle over a Prisma drift prompt.
#
# ─────────────────────────────────────────────────────────────────────────
# ⚠️  If `pnpm db:migrate` (inside this script) reports drift or prompts
#     a Y/N question:
#       1. Press Ctrl+C and stop. Do NOT press N.
#       2. Do NOT manually run `prisma migrate resolve --applied` for each
#          migration — that marks history as "done" WITHOUT running the
#          SQL, which is how tables like expenses/cash_accounts end up
#          missing while everything else looks fine.
#       3. Instead, wipe the volume and start over on a clean slate:
#            pnpm docker:reset && ./scripts/fresh-setup.sh
#     Drift only happens when commands are run out of order or a previous
#     half-finished setup attempt left the DB in a partial state — never
#     on a genuinely fresh, empty database.
# ─────────────────────────────────────────────────────────────────────────

set -euo pipefail
cd "$(dirname "$0")/.."

echo "🏨  Hotel PMS — fresh machine setup"
echo "────────────────────────────────────────────"

echo "▶  Starting Postgres + Redis containers…"
pnpm docker:up

echo "▶  Waiting for Postgres to be healthy…"
ATTEMPTS=0
MAX_ATTEMPTS=30
until [ "$(docker inspect -f '{{.State.Health.Status}}' pms_postgres 2>/dev/null || echo starting)" = "healthy" ]; do
  ATTEMPTS=$((ATTEMPTS + 1))
  if [ "$ATTEMPTS" -ge "$MAX_ATTEMPTS" ]; then
    echo "❌  Postgres did not become healthy after ${MAX_ATTEMPTS} attempts."
    echo "    Check: docker compose logs postgres"
    exit 1
  fi
  sleep 1
done
echo "✔  Postgres is healthy."

echo "▶  Running setup (migrate → RLS → generate → seed)…"
if ! pnpm setup; then
  echo ""
  echo "❌  Setup failed — most likely Prisma reported migration drift."
  echo "    Do NOT manually resolve migrations as applied without running their SQL."
  echo "    Wipe the volume and try again on a clean slate:"
  echo "      pnpm docker:reset && ./scripts/fresh-setup.sh"
  exit 1
fi

echo ""
echo "✅  Setup complete!"
echo "────────────────────────────────────────────"
echo "  Demo login credentials"
echo "────────────────────────────────────────────"
echo "  Hotel slug : demo-hotel"
echo "  Email      : admin@demo-hotel.com"
echo "  Password   : Admin1234!"
echo "────────────────────────────────────────────"
echo ""
echo "Run 'pnpm dev' to start the app:"
echo "  Web  → http://localhost:5173"
echo "  API  → http://localhost:4000/api/health"
