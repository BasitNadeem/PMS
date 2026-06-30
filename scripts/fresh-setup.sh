#!/bin/bash
# fresh-setup.sh — one-command, fully unattended first-time setup for a
# brand new machine. Safe to run zero or many times on a fresh DB volume.
#
# Why this exists instead of just `pnpm setup`:
#   `pnpm setup` runs `pnpm db:migrate`, which is `prisma migrate dev` —
#   the INTERACTIVE dev workflow command. It diffs the live database
#   against migration history via a shadow database and, on any mismatch,
#   prompts "drift detected, reset? (y/N)". In an unattended script that
#   prompt either hangs waiting for stdin or gets answered wrong, and
#   pressing N + manually running `prisma migrate resolve --applied` for
#   each migration marks history as "done" WITHOUT ever running the SQL —
#   which is how tables like expenses/cash_accounts/ledger_entries end up
#   silently missing while everything else looks fine.
#
#   `prisma migrate deploy` is the correct tool here: it only reads the
#   migration history table, applies whatever isn't recorded yet, in
#   order, and never prompts. It does not diff against live schema state
#   at all, so it is immune to the drift class of problem entirely.
#
# Order matters: migrations create the tables; `apply:rls` only adds
# Row-Level Security policies and triggers ON TOP OF tables that already
# exist. Running it first fails outright (the tables don't exist yet).
#
# ─────────────────────────────────────────────────────────────────────────
# ⚠️  If this script still fails on `migrate deploy`, do NOT manually run
#     `prisma migrate resolve --applied` to skip past it — that's what
#     causes tables to go missing. Wipe the volume and retry clean:
#       pnpm docker:reset && pnpm fresh-setup
# ─────────────────────────────────────────────────────────────────────────

set -euo pipefail
cd "$(dirname "$0")/.."

echo "🏨  Hotel PMS — fresh machine setup"
echo "────────────────────────────────────────────"

echo "▶  Installing dependencies…"
pnpm install

echo "▶  Starting Postgres + Redis containers…"
pnpm docker:up

wait_for_healthy() {
  local container="$1"
  local max_attempts="$2"
  local attempts=0
  until [ "$(docker inspect -f '{{.State.Health.Status}}' "$container" 2>/dev/null || echo starting)" = "healthy" ]; do
    attempts=$((attempts + 1))
    if [ "$attempts" -ge "$max_attempts" ]; then
      return 1
    fi
    sleep 1
  done
  return 0
}

echo "▶  Waiting for Postgres to be healthy…"
if ! wait_for_healthy pms_postgres 60; then
  echo "❌  Postgres did not become healthy after 60s. Check: docker compose logs postgres"
  exit 1
fi
echo "✔  Postgres is healthy."

echo "▶  Waiting for Redis to be healthy…"
if ! wait_for_healthy pms_redis 30; then
  echo "⚠  Redis health check timed out — continuing anyway (only affects WhatsApp briefing queue)."
else
  echo "✔  Redis is healthy."
fi

echo "▶  Generating Prisma client…"
pnpm db:generate

echo "▶  Applying database migrations (non-interactive)…"
if ! pnpm db:migrate:deploy; then
  echo ""
  echo "❌  Migration deploy failed."
  echo "    Do NOT manually run 'prisma migrate resolve --applied' to skip past this."
  echo "    Wipe the volume and try again on a clean slate:"
  echo "      pnpm docker:reset && pnpm fresh-setup"
  exit 1
fi

echo "▶  Applying Row-Level Security policies and triggers…"
pnpm apply:rls

echo "▶  Seeding system roles + demo hotel…"
pnpm db:seed

echo "▶  Verifying setup…"
bash scripts/verify-db.sh || true

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
