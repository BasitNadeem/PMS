# PMS Monorepo — Engineering Rules

## Stack
- **Monorepo**: pnpm workspaces + Turborepo
- **Frontend**: `apps/web` — React 18, Vite, TypeScript, Tailwind CSS, TanStack Query v5, Formik + Yup, React Router v6
- **Backend**: `apps/api` — Express, TypeScript, Zod, Prisma (via `@pms/db`)
- **Shared packages**: `packages/ui` (primitives), `packages/db` (Prisma client + schema)

## Running the project
```bash
pnpm dev                        # run all apps in parallel (turborepo)
pnpm --filter @pms/web dev      # web only
pnpm --filter @pms/api dev      # api only
pnpm typecheck                  # typecheck all packages
pnpm lint                       # lint all packages
```

## General rules (apply everywhere)
- **No `any`** — use `unknown` and narrow, or define a proper type.
- **No implicit side effects** at module scope — only in functions/effects.
- **Delete dead code** — no commented-out blocks, no `_unused` variables.
- **Absolute imports** within each app root (configured via `tsconfig paths` or Vite alias).
- **Env vars** are validated with Zod at startup — never access `process.env` directly.

## Cross-cutting patterns
- All API responses follow the envelope: `{ data: T, meta?: PaginationMeta }` for success.
- All error responses: `{ error: string, details?: unknown }`.
- Pagination params are always `page` (1-based) + `limit` (max 100).
- All dates stored as UTC; frontend formats with `Intl.DateTimeFormat`.
- Tenant isolation is mandatory — every authenticated route uses `req.withTenant`.
