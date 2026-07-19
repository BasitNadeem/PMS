# Hotel PMS

Multi-tenant hotel property management system — reservations, billing, housekeeping, POS, QR ordering, and more.

---

## Quick start

**Requirements:** Node.js ≥ 20, pnpm ≥ 9, Docker Desktop (running).

```bash
git clone <repo-url>
cd PMS
cp .env.example .env       # defaults work for local dev — no edits needed
pnpm fresh-setup           # installs deps, starts Docker, migrates, seeds, verifies
pnpm dev                   # starts all apps
```

That's it. `pnpm fresh-setup` is fully unattended — no prompts, no manual steps.

---

## Ports

| Service | URL |
|---|---|
| Web app | http://localhost:5173 |
| Admin panel | http://localhost:5174 |
| API | http://localhost:4000 |
| API health | http://localhost:4000/api/health |
| Prisma Studio | http://localhost:5555 (run `pnpm db:studio`) |
| PostgreSQL | localhost:5433 |
| Redis | localhost:6379 |

---

## Default credentials

| Panel | URL | Email | Password |
|---|---|---|---|
| Hotel app | localhost:5173 | admin@demo-hotel.com | Admin1234! |
| Admin panel | localhost:5174 | admin@yourpms.com | AdminPass123! |

Hotel slug: `demo-hotel`

---

## Common commands

| Command | What it does |
|---|---|
| `pnpm dev` | Start API + web in watch mode |
| `pnpm fresh-setup` | Full setup from scratch — use on a new machine |
| `pnpm verify-db` | Check every table, RLS status, migration history |
| `pnpm typecheck` | TypeScript check across all packages |
| `pnpm lint` | ESLint across all packages |
| `pnpm db:migrate` | Create + apply a new migration (interactive, for schema changes) |
| `pnpm db:generate` | Regenerate Prisma client after schema changes |
| `pnpm db:studio` | Open Prisma Studio |
| `pnpm db:seed` | Re-seed system roles |
| `pnpm apply:rls` | Re-apply RLS policies and grants |
| `pnpm docker:up` | Start Postgres + Redis containers |
| `pnpm docker:down` | Stop containers |
| `pnpm docker:reset` | Wipe DB volume + restart (destructive) |

---

## Troubleshooting

**⚠️ NEVER run `prisma db push` on this project**
This project has raw-SQL tables managed entirely outside `schema.prisma` (via migration files):
`expenses`, `cash_accounts`, `ledger_entries`, `whatsapp_briefing_logs`,
`menu_categories`, `menu_items`, `qr_orders`, `qr_order_items`.

`prisma db push` syncs the DB to match `schema.prisma` exactly and **silently drops** any table
not listed there — including all of the above. This incident occurred on 2026-07-15 and wiped
all 8 tables with no warning or confirmation prompt.

The `db:push` npm script has been removed from `package.json` to prevent accidental use.
For schema changes, always use:
```bash
pnpm db:migrate        # prisma migrate dev — creates + applies a new migration interactively
pnpm db:migrate:deploy # prisma migrate deploy — applies existing migrations only (CI/prod)
```
If you've already run `db push` and tables are missing, re-run the affected migration SQL files directly:
```bash
# Example — re-apply the expenses migration after a db push incident:
docker exec -i pms_postgres psql -U pms_user -d hotel_pms \
  < packages/db/prisma/migrations/20260604000001_add_expenses/migration.sql
# All affected migration SQL files use IF NOT EXISTS and are safe to re-run.
# Run pnpm verify-db afterwards to confirm recovery.
```

**Cannot connect to database**
- Make sure Docker Desktop is running
- `pnpm docker:up` — starts the containers
- `lsof -i :5433` — check nothing else holds the port

**Migration drift / "drift detected" prompt during `pnpm db:migrate`**
Do not press N, and do not run `prisma migrate resolve --applied` — that marks a migration as applied without running its SQL, silently leaving tables missing. Wipe and start clean instead:
```bash
pnpm docker:reset && pnpm fresh-setup
```

**Tables missing after setup**
Run `pnpm verify-db` for a table-by-table report. If tables are missing, the migration ran with `resolve --applied` (see above). Fix: `pnpm docker:reset && pnpm fresh-setup`.

**API fails to start with "VAPID_PUBLIC_KEY is required"**
The `.env` file is missing the VAPID keys. Copy `.env.example` to `.env` — the example includes working dev VAPID keys.

**Port already in use**
```bash
lsof -ti :4000 | xargs kill
lsof -ti :5173 | xargs kill
```

**Prisma client out of date**
```bash
pnpm db:generate
```

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite + Tailwind |
| Data fetching | TanStack Query v5 |
| Forms | Formik + Yup |
| Routing | React Router v6 |
| Backend | Node.js 20 + Express + TypeScript |
| Validation | Zod |
| Auth | JWT (access + refresh tokens) |
| Database | PostgreSQL 16 |
| ORM | Prisma 5 |
| Queue / cache | Redis (BullMQ) |
| Monorepo | pnpm workspaces + Turborepo |

---

## Database

- PostgreSQL runs on port **5433** (not 5432, to avoid conflicts with local installs)
- DBeaver: host `localhost`, port `5433`, db `hotel_pms`, user `pms_user`, password `pms_pass`
- All money stored as **integers in paise** (₨ 1 = 100 paise, no floats)
- All timestamps stored as **UTC**
- **Row-Level Security** enforced at DB level — every query is automatically scoped to the current hotel. Cannot be bypassed by application code.
- Two DB roles: `pms_user` (superuser, migrations only) and `hotel_pms_app` (restricted, API runtime)

### Why `fresh-setup` uses `migrate deploy` and not `migrate dev`

`migrate dev` is interactive — on any schema drift it shows a Y/N reset prompt. Pressing N and then using `migrate resolve --applied` to skip marks migrations as done without running their SQL, causing tables to appear missing. `migrate deploy` only applies unapplied migrations from history, never prompts, and is safe for automated setup.

---

## Production Build & Deployment

`VITE_API_URL` **must be set as an environment variable before running `pnpm build`** for
`apps/web` and `apps/admin` — Vite bakes `VITE_*` vars into the compiled bundle at build
time, not runtime. Setting it in a server-side `.env` file after the fact has no effect;
the value has to be present in the shell environment when the build command itself runs.

`apps/admin`'s build will now fail loudly (via `vite.config.ts`) if `VITE_API_URL` is
unset, rather than silently shipping a bundle pointed at `localhost:4000`.

For InnFlo's production domain structure:

```bash
# apps/web build
VITE_API_URL=https://api.innflo.co pnpm --filter @pms/web build

# apps/admin build
VITE_API_URL=https://api.innflo.co pnpm --filter @pms/admin build
```

`apps/api` reads its config from `lib/env.ts` (validated with Zod) at process **startup**,
not build time — its real production `.env` file just needs to exist on the server before
running `node dist/index.js` (see `.env.example` for the full list of required vars).

---

## Project layout

```
apps/
  api/          Express REST API
  web/          React frontend
packages/
  db/           Prisma client, schema, migrations, seed
  ui/           Shared component library
scripts/
  fresh-setup.sh
  verify-db.sh
  apply-rls.ts
```
