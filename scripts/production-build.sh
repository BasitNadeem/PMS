#!/bin/bash
set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

log()     { echo -e "${BLUE}▶${NC}  $1"; }
success() { echo -e "${GREEN}✓${NC}  $1"; }
error()   { echo -e "${RED}✗${NC}  $1"; exit 1; }

echo ""
echo "🏗️   InnFlo — Production Build"
echo "════════════════════════════════════════"
echo ""

# ── Load production API URL ────────────────────────────
# Reads from .env.production if it exists, otherwise
# requires it to be already exported in the shell
if [ -f .env.production ]; then
  log "Loading .env.production..."
  export $(grep -v '^#' .env.production | xargs)
fi

if [ -z "$VITE_API_URL" ]; then
  error "VITE_API_URL is not set.
  Set it in .env.production (see .env.production.example)
  or export it manually before running this script:
    VITE_API_URL=https://api.innflo.co pnpm build:prod"
fi

log "Building with VITE_API_URL=$VITE_API_URL"

# ── Run the actual build ───────────────────────────────
# @pms/marketing is deliberately excluded. Its pages are prerendered to static
# HTML by a headless browser (see apps/marketing/scripts/prerender.mjs), which
# needs Playwright — deliberately not installed on the server. Building it here
# would overwrite the prerendered dist/ with an empty-shell SPA build and
# silently undo the site's search and AI visibility. Deploy it with
# `pnpm deploy:marketing` from a development machine instead.
# Calling turbo directly avoids pnpm consuming --filter as its own flag.
VITE_API_URL="$VITE_API_URL" pnpm exec turbo run build --filter='!@pms/marketing'

success "Production build complete"
echo ""
echo "Built artifacts:"
echo "  apps/web/dist"
echo "  apps/admin/dist"
echo "  apps/api/dist"
echo ""
echo "Not built here: apps/marketing (prerendered)."
echo "  Deploy it from a dev machine with:  pnpm deploy:marketing"
echo ""
