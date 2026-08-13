#!/bin/bash
set -euo pipefail

# Build and deploy the marketing site (innflo.co).
#
# Run this from a development machine, NOT the server. The site's pages are
# prerendered to static HTML by a headless browser so that search and AI
# crawlers — none of which execute JavaScript — see real content instead of an
# empty <div id="root">. That needs Playwright, which is intentionally not
# installed on the server, so the built output is uploaded rather than rebuilt
# there. `pnpm build:prod` on the server skips this app for the same reason.
#
# Override the target if it differs:
#   INNFLO_DEPLOY_HOST=root@1.2.3.4 pnpm deploy:marketing

GREEN='\033[0;32m'; BLUE='\033[0;34m'; RED='\033[0;31m'; YELLOW='\033[0;33m'; NC='\033[0m'
log()     { echo -e "${BLUE}▶${NC}  $1"; }
success() { echo -e "${GREEN}✓${NC}  $1"; }
warn()    { echo -e "${YELLOW}!${NC}  $1"; }
error()   { echo -e "${RED}✗${NC}  $1"; exit 1; }

HOST="${INNFLO_DEPLOY_HOST:-root@innflo.co}"
REMOTE_DIR="${INNFLO_MARKETING_DIR:-/opt/innflo/apps/marketing/dist/}"
LOCAL_DIR="apps/marketing/dist/"

echo ""
echo "🌐  Innflo — Marketing Deploy"
echo "════════════════════════════════════════"
echo ""

command -v rsync >/dev/null || error "rsync is not installed."

log "Building and prerendering..."
pnpm --filter @pms/marketing build:static

# The prerender step exits non-zero if a route renders blank, so reaching here
# means every route produced real HTML. Re-check anyway: shipping an empty shell
# would silently undo the site's crawlability, and that is worth a hard stop.
if grep -q '<div id="root"></div>' "${LOCAL_DIR}index.html"; then
  error "dist/index.html still has an empty root div — prerendering did not run."
fi

PAGES=$(find "$LOCAL_DIR" -name index.html | wc -l | tr -d ' ')
success "Prerendered ${PAGES} pages"

echo ""
warn "About to replace ${REMOTE_DIR} on ${HOST}"
warn "Files there that are not in the local build will be deleted."
read -r -p "Continue? [y/N] " reply
[[ "$reply" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 0; }

log "Uploading to ${HOST}:${REMOTE_DIR} ..."
rsync -avz --delete "$LOCAL_DIR" "${HOST}:${REMOTE_DIR}"

success "Deployed"
echo ""
echo "Verify:"
echo "  curl -s https://innflo.co/pricing | grep -o '<title>[^<]*'"
echo "  curl -s https://innflo.co/ | grep -c 'id=\"root\"></div>'   # want 0"
echo ""
