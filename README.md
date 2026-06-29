# Hotel PMS

A multi-tenant **Hotel Property Management System** built for the Pakistani hospitality market. It runs as a web application that hotels use to manage reservations, guests, rooms, billing, housekeeping, staff, and more — all from a single dashboard.

---

## Table of Contents

1. [What This System Does](#1-what-this-system-does)
2. [Who Can Use It](#2-who-can-use-it)
3. [Repository Structure](#3-repository-structure)
4. [Tech Stack](#4-tech-stack)
5. [Prerequisites](#5-prerequisites)
6. [First-Time Setup](#6-first-time-setup)
7. [Running the Project](#7-running-the-project)
8. [Environment Variables](#8-environment-variables)
9. [Database Architecture](#9-database-architecture)
10. [Roles and Permissions](#10-roles-and-permissions)
11. [System Modules](#11-system-modules)
12. [API Reference](#12-api-reference)
13. [Development Workflow](#13-development-workflow)
14. [Useful Commands](#14-useful-commands)
15. [Troubleshooting](#15-troubleshooting)

---

## 1. What This System Does

This PMS (Property Management System) is a web-based tool that helps hotels run their day-to-day operations digitally. Instead of using paper registers or disconnected spreadsheets, hotel staff log into this system to handle everything in one place.

**Core capabilities:**

- Accept and manage room reservations from any source (walk-in, phone, WhatsApp, Booking.com, Agoda, Expedia, etc.)
- Check guests in and out, track room status in real time
- Manage guest profiles with identity documents (CNIC, Passport)
- Generate and manage bills (folios) for each stay
- Accept payments via cash, JazzCash, EasyPaisa, bank transfer, and more
- Run a Point-of-Sale (food & beverage orders posted directly to the guest's bill)
- Assign housekeeping tasks and track room cleaning
- Log maintenance tickets for repairs
- Unified messaging inbox for WhatsApp, Booking.com, Agoda, email, and SMS
- Manage room rates, seasonal pricing, and OTA channel connections
- Shift reports and daily cash reconciliation
- FBR invoice compliance (GST, PST, WHT tax support)
- Full audit trail of every action in the system

**Designed for:** Hotels, guesthouses, resorts, lodges, hostels, serviced apartments, and campsites across Pakistan.

---

## 2. Who Can Use It

The system supports **multiple hotels** on a single installation. Each hotel is completely isolated — staff at Hotel A can never see data from Hotel B.

Each user belongs to one or more hotels and has a role that controls what they can see and do:

| Role | Who |
|---|---|
| **Owner** | Hotel owner — full access to everything |
| **Manager** | General manager — all operations, reports |
| **Front Desk** | Receptionists — reservations, check-in/out, payments |
| **Housekeeping** | Cleaning staff — room task management |
| **Kitchen** | Kitchen staff — POS orders |
| **Maintenance** | Maintenance team — repair tickets |
| **Accountant** | Finance staff — billing, payments, invoices |

---

## 3. Repository Structure

This is a **monorepo** — one Git repository that contains multiple apps and shared packages, all managed together.

```
hotel-pms/
│
├── apps/
│   ├── api/              # Backend — REST API server (Node.js + Express)
│   │   └── src/
│   │       ├── index.ts          # Server entry point
│   │       ├── lib/
│   │       │   └── env.ts        # Environment variable validation
│   │       ├── middleware/
│   │       │   ├── auth.ts       # JWT authentication
│   │       │   ├── tenant.ts     # Injects hotel context into every request
│   │       │   └── error.ts      # Global error handler
│   │       └── routes/
│   │           ├── auth.ts       # Login, refresh token, logout
│   │           ├── health.ts     # Health check endpoint
│   │           ├── hotels.ts     # Hotel management
│   │           └── reservations.ts
│   │
│   └── web/              # Frontend — React web app (Vite)
│       └── src/
│           ├── main.tsx          # React entry point
│           ├── App.tsx           # Routes and layout
│           ├── pages/
│           │   ├── LoginPage.tsx
│           │   └── DashboardPage.tsx
│           ├── components/       # Page-level UI components
│           ├── hooks/            # Custom React hooks
│           └── lib/
│               └── api.ts        # Axios client (auto-attaches JWT)
│
├── packages/
│   ├── db/               # Database layer — Prisma ORM
│   │   └── src/
│   │       ├── index.ts          # Exports prisma client + all types
│   │       ├── tenant.ts         # withTenant() — sets RLS session vars
│   │       ├── admin.ts          # adminPrisma — superuser client
│   │       └── seed.ts           # Seeds system roles into the DB
│   │   └── prisma/
│   │       ├── schema.prisma     # Full database schema (source of truth)
│   │       └── migrations/       # Applied migration history
│   │
│   └── ui/               # Shared React component library
│       └── src/
│           ├── Button.tsx
│           ├── Badge.tsx
│           └── index.ts
│
├── scripts/
│   └── apply-rls.ts      # Applies Row-Level Security policies to Postgres
│
├── schema.prisma         # Root copy of the schema (for quick reference)
├── er_diagram.mermaid    # Entity-relationship diagram source
├── er_diagram.png        # ER diagram image
├── docker-compose.yml    # Postgres 16 container definition
├── .env.example          # Template for environment variables
├── turbo.json            # Turborepo pipeline config
├── pnpm-workspace.yaml   # Workspace package definitions
└── package.json          # Root scripts and tooling
```

---

## 4. Tech Stack

| Layer | Technology | Why |
|---|---|---|
| **Frontend** | React 18 + TypeScript | Component-based UI |
| **Routing** | React Router v6 | Client-side navigation |
| **Data fetching** | TanStack Query (React Query) | Server state, caching, refetching |
| **HTTP client** | Axios | API calls with interceptors |
| **Styling** | TailwindCSS | Utility-first CSS |
| **Build tool** | Vite | Fast dev server and builds |
| **Backend** | Node.js 20 + Express + TypeScript | REST API server |
| **Validation** | Zod | Schema validation for all API inputs |
| **Auth** | JWT (access + refresh tokens) | Stateless authentication |
| **Password hashing** | bcryptjs | Secure password storage |
| **Database** | PostgreSQL 16 | Primary data store |
| **ORM** | Prisma 5 | Type-safe database access |
| **Container** | Docker (docker-compose) | Runs Postgres locally |
| **Monorepo** | Turborepo + pnpm workspaces | Manages multiple apps together |
| **Language** | TypeScript throughout | End-to-end type safety |

---

## 5. Prerequisites

Before you can run this project you need the following installed on your machine:

### Required

| Tool | Version | How to check | Install |
|---|---|---|---|
| **Node.js** | >= 20 | `node -v` | [nodejs.org](https://nodejs.org) |
| **pnpm** | >= 9 | `pnpm -v` | `npm install -g pnpm` |
| **Docker Desktop** | Latest | `docker -v` | [docker.com](https://www.docker.com/products/docker-desktop) |

### Optional but useful

| Tool | Purpose |
|---|---|
| **DBeaver** | Visual database browser |
| **Postman / Insomnia** | API testing |
| **VS Code** | Recommended editor (has Prisma extension) |

> **Make sure Docker Desktop is running** before starting the project. The database runs inside Docker.

---

## 6. First-Time Setup

Follow these steps in order. You only need to do this once.

### Step 1 — Clone and install dependencies

```bash
git clone <repository-url>
cd hotel-pms
pnpm install
```

This installs dependencies for all apps and packages at once.

### Step 2 — Create your environment file

```bash
cp .env.example .env
```

The defaults in `.env.example` work out of the box for local development. You do not need to change anything to get started.

> See [Environment Variables](#8-environment-variables) for a full explanation of each setting.

### Step 3 — Run the full setup

```bash
pnpm fresh-setup
```

This waits for Postgres to actually be ready, then runs `pnpm setup`, which does five things **in this exact order**:
1. Starts the PostgreSQL Docker container
2. Runs all database migrations (creates all tables)
3. Applies Row-Level Security policies (on top of the tables migrations just created)
4. Generates the Prisma client (TypeScript types for the DB)
5. Seeds the 7 system roles + a demo hotel/admin login

If you don't want the Postgres-readiness wait, `pnpm setup` alone does the same five steps — just with a blind 3-second sleep instead of a health check, which can be too short on a slow first run.

> ⚠️ **If step 2 (`db:migrate`) reports migration drift or prompts a Y/N question, press Ctrl+C — do NOT press N, and do NOT manually run `prisma migrate resolve --applied` for each migration to "get past it".** That marks migration history as applied **without running the SQL**, which is exactly how tables like `expenses`, `cash_accounts`, `ledger_entries`, and `whatsapp_briefing_logs` can end up silently missing while the app otherwise seems to work. Drift only happens from running commands out of order or retrying a half-finished setup — never on a truly empty database. If you hit it, wipe the volume and start clean:
> ```bash
> pnpm docker:reset && pnpm fresh-setup
> ```

### Step 4 — Start the application

```bash
pnpm dev
```

Both servers start in parallel:

| Service | URL |
|---|---|
| Web app | http://localhost:5173 |
| API | http://localhost:4000 |
| API health check | http://localhost:4000/api/health |

---

## 7. Running the Project

### Daily start (after first-time setup is done)

If Docker is still running from a previous session:

```bash
pnpm dev
```

If Docker was stopped (e.g. after a system restart):

```bash
pnpm docker:up
pnpm dev
```

### Stopping

Press `Ctrl + C` in the terminal to stop the dev servers.

To also stop the database:

```bash
pnpm docker:down
```

---

## 8. Environment Variables

Copy `.env.example` to `.env`. Here is what each variable does:

```env
# ── Database ──────────────────────────────────────────────────────────────────

# Used by the API at runtime. Subject to Row-Level Security.
# In development, you can point both URLs to pms_user for simplicity.
DATABASE_URL="postgresql://pms_user:pms_pass@localhost:5433/hotel_pms?schema=public"

# Used only for migrations, seeding, and the apply-rls script.
# Has full superuser access — never use this in API code.
DIRECT_URL="postgresql://pms_user:pms_pass@localhost:5433/hotel_pms?schema=public"

# Password for the restricted app DB role (set during apply-rls)
DB_APP_PASSWORD="pms_app_dev_pass"

# ── Authentication ────────────────────────────────────────────────────────────

# Secret key used to sign JWTs. Change this to a random string in production.
# Generate one with: openssl rand -base64 32
JWT_SECRET="dev-jwt-secret-32-chars-minimum!!"

# How long an access token is valid (15 minutes is standard)
JWT_EXPIRES_IN="15m"

# How long a refresh token is valid (7 days)
JWT_REFRESH_EXPIRES_IN="7d"

# ── Server ────────────────────────────────────────────────────────────────────

PORT=4000
NODE_ENV=development

# ── Frontend ──────────────────────────────────────────────────────────────────

# The API URL the React app uses. Must match the API port above.
VITE_API_URL=http://localhost:4000
```

> **Important for production:** Change `JWT_SECRET` to a strong random value. Never commit a real `.env` file to Git.

---

## 9. Database Architecture

### PostgreSQL on port 5433

The database runs in Docker on port **5433** (not the default 5432) to avoid conflicts with any existing local PostgreSQL installation.

Connection details for DBeaver or any DB client:

| Field | Value |
|---|---|
| Host | `localhost` |
| Port | `5433` |
| Database | `hotel_pms` |
| Username | `pms_user` |
| Password | `pms_pass` |

### Multi-tenancy — how one database serves many hotels

Every table in the database has a `hotel_id` column. This means all hotels share the same tables, but each row belongs to exactly one hotel.

**Row-Level Security (RLS)** is a PostgreSQL feature that automatically filters every query based on the current hotel. When a staff member from Hotel A logs in, every database query — no matter what code runs — automatically adds `WHERE hotel_id = 'hotel-a-uuid'`. It is impossible for the application to accidentally return another hotel's data, even if a developer makes a coding mistake.

This is enforced at the **database level**, not the application level. It is the strongest form of tenant isolation available.

### Two database roles

| Role | Access | Used by |
|---|---|---|
| `pms_user` | Full superuser — sees everything, bypasses RLS | Migrations, seed, DBeaver, admin scripts |
| `hotel_pms_app` | Restricted — only sees current hotel's rows (RLS enforced) | API server at runtime |

> In development, it is fine to use `pms_user` for everything (just point both `DATABASE_URL` and `DIRECT_URL` to `pms_user`).

### How tenant context flows through a request

```
1. User logs in  →  API issues a JWT containing { userId, hotelId, role }
2. Every API request  →  JWT is verified, hotelId extracted
3. Route handler calls  req.withTenant((db) => db.room.findMany(...))
4. withTenant() opens a Prisma transaction and runs:
       SET LOCAL app.current_hotel_id = '<hotelId>'
       SET LOCAL app.current_user_id  = '<userId>'
5. PostgreSQL RLS policies read these session variables
6. Every query is automatically scoped to that hotel
```

### Money — always integers (paise)

All monetary values in the database are stored as **integers representing paise** (1/100 of a Rupee). This avoids floating-point precision errors in financial calculations.

```
Rs 5,000.00  →  stored as  500000
Rs 150.50    →  stored as   15050
```

Convert to display: `amount / 100`. Convert to store: `Math.round(displayValue * 100)`.

### Trigger-maintained columns

Some columns are automatically kept in sync by PostgreSQL triggers (defined in `rls_and_triggers.sql`). You should **never update these manually**:

| Column | Table | Maintained by |
|---|---|---|
| `fullName` | `guests` | Trigger on `firstName` / `lastName` change |
| `totalStays` | `guests` | Trigger on reservation checkout |
| `totalSpend` | `guests` | Trigger on payment posted |
| `balanceDue` | `folios` | Trigger on folio item / payment change |

---

## 10. Roles and Permissions

The system has two layers of access control:

### Layer 1 — Role enum (fast, on the JWT)

When a user logs in, their role (`OWNER`, `MANAGER`, `FRONT_DESK`, etc.) is embedded in the JWT. The API checks this for quick role-based route guards without hitting the database.

### Layer 2 — Permission table (fine-grained, Phase 2)

The `Permission`, `Role`, and `RolePermission` tables store granular permissions like `payments:refund`, `reservations:cancel`, `reports:view`. These are seeded empty and will be populated in Phase 2 to allow per-hotel custom role configurations.

### Login flow

When a user logs in they must provide three things:
1. Their **email**
2. Their **password**
3. The **hotel slug** (e.g. `grand-hotel`) — this identifies which property they are logging into

This means the same person can be staff at multiple hotels, each with a different role.

---

## 11. System Modules

### Reservations
Full guest stay lifecycle management.

Statuses: `ENQUIRY → CONFIRMED → CHECKED_IN → CHECKED_OUT`
Also handles: `NO_SHOW`, `CANCELLED`, `WAITLISTED`

Booking sources tracked: Walk-in, Phone, WhatsApp, Direct Website, Booking.com, Agoda, Expedia, Airbnb, Bookme.pk, SastaTicket.pk, Travel Agent, other OTAs.

### Room Management
- Define room types (Single, Double, Suite, Dormitory, Tent/Glamping, etc.)
- Track individual room status: `VACANT_CLEAN`, `VACANT_DIRTY`, `OCCUPIED`, `OUT_OF_ORDER`, `UNDER_MAINTENANCE`, `BLOCKED`
- Room floor, notes, last cleaned timestamp

### Guest Profiles
- Store personal info, contact details, nationality
- Identity documents: CNIC, Passport, Driving License, NRIC
- Document scan URL, expiry date
- VIP level, internal notes, tags
- Guest blacklist with severity levels and cross-property sharing
- Full-text search via PostgreSQL `tsvector` (GIN indexed)

### Group Bookings
- Link multiple reservations under one group
- Designate a group leader
- Flexible billing: split per guest or single payer (corporate, tour operator)

### Folio & Billing
Each reservation has one folio (the bill). A folio contains:
- **Folio items**: room charges, food & beverage, laundry, transport, spa, minibar, tax, discounts, adjustments
- **Payments**: settled amounts
- **Running balance**: automatically maintained by DB triggers
- **Split billing**: divide the bill between multiple payers
- Link to FBR invoice for tax compliance

### Payments
Supported methods: Cash, JazzCash, EasyPaisa, Bank Transfer, Credit Card, Debit Card, Cheque, Advance Deposit, OTA Collect, Complimentary.

Full refund support with `originalPaymentId` linkage.

### Point of Sale (POS)
- Categorize food & beverage items
- Urdu name support (`nameUrdu`)
- Link menu items to inventory for auto stock deduction (Phase 2)
- Post orders directly to the guest's folio
- Kitchen items flagged separately for KOT (kitchen order ticket)

### Housekeeping
- Create cleaning tasks per room per day
- Assign to specific staff
- Track status: `PENDING → IN_PROGRESS → COMPLETED` (also `SKIPPED`, `ESCALATED`)
- Report issues with photo URLs
- Escalation flag for supervisor attention

### Maintenance
- Ticket-based system with unique ticket number
- Priority levels: `LOW`, `MEDIUM`, `HIGH`, `URGENT`
- Status: `OPEN → IN_PROGRESS → AWAITING_PARTS → RESOLVED → CLOSED`
- Cost tracking (estimated vs actual)
- Parts used (JSON)

### Inventory (Phase 2 stub)
- Item catalogue with SKU, unit, category
- Par level and reorder level alerts
- Transaction log: Purchase, Consumption, Waste, Adjustment, Transfer
- Linked to POS items for automatic deduction on order

### Unified Messaging Inbox
- Centralised inbox for all guest communications
- Channels: WhatsApp, Booking.com, Agoda, Expedia, Email, SMS, Internal
- Inbound and outbound messages
- Assign conversations to specific staff
- Snooze, tag, mark read/unread
- Template message support

### Rate Plans
- Standard, Seasonal, Promotional, Corporate, Travel Agent, OTA Net, Complimentary
- Date range validity, days-of-week restrictions
- Minimum/maximum length of stay
- Advance booking window (min/max days ahead)
- Modifier: fixed amount or percentage over base rate

### Channel Manager (Phase 2 stub)
- Connect to OTAs: Booking.com, Agoda, Expedia, Airbnb, Bookme.pk, SastaTicket.pk
- Store API credentials per channel
- Sync inventory and rates
- Commission rate per channel
- Sync status and error logging

### Staff & Shift Reports
- Staff profiles linked to users (employee ID, department, designation)
- Daily shift reports: opening/closing cash balance, variance
- Check-in, check-out, and new booking counts per shift
- Sign-off workflow

### Tax & Compliance
- Configure tax types per hotel: GST, PST/PRA, SST/SRB, KPST/KPRA, GBST/GBRA, WHT, Accommodation Tax
- Inclusive or exclusive tax
- FBR invoice integration: draft → issued → submitted → accepted/rejected
- FBR invoice number and response stored per invoice

### Audit Log
- Append-only record of every create, update, delete action
- Stores before and after state (JSON diff)
- IP address and user agent logged
- Cannot be modified or deleted

### Notifications
- In-app notification system
- Broadcast (hotel-wide) or user-specific
- Mark read/unread with timestamp
- Extensible metadata JSON field

### Custom Fields
- Hotel admins can define extra fields for any entity (guest, reservation, room, etc.)
- Field types: text, number, date, select, boolean
- Required or optional
- Values stored in a normalised key-value table

---

## 12. API Reference

Base URL: `http://localhost:4000`

All endpoints under `/api/*` (except health and auth) require a `Bearer` token in the `Authorization` header.

### Auth

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/login` | Login with email + password + hotelSlug. Returns `accessToken` + `refreshToken`. |
| `POST` | `/api/auth/refresh` | Exchange a valid refresh token for a new access token. |
| `POST` | `/api/auth/logout` | Invalidates the refresh token server-side. |

**Login request body:**
```json
{
  "email": "manager@example.com",
  "password": "yourpassword",
  "hotelSlug": "grand-hotel"
}
```

**Login response:**
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "user": {
    "id": "uuid",
    "name": "John",
    "email": "manager@example.com",
    "role": "MANAGER",
    "permissions": ["reservations:create", "payments:view"]
  },
  "hotel": {
    "id": "uuid",
    "name": "Grand Hotel",
    "slug": "grand-hotel"
  }
}
```

### Health

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Returns `{ ok: true }`. Use to confirm the API is running. |

### Hotels

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/hotels/:hotelId` | Get hotel details |

### Reservations

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/reservations` | List reservations for the current hotel |
| `POST` | `/api/reservations` | Create a new reservation |

> More routes will be added as development progresses.

### Rate limiting

API routes are rate-limited to **500 requests per 15 minutes** per IP. This is intentionally generous for development.

---

## 13. Development Workflow

### Making schema changes

The database schema is the source of truth for the entire system. When you need to add a table, column, or index:

1. Edit `packages/db/prisma/schema.prisma`
2. Create a migration:
   ```bash
   pnpm db:migrate
   # Prisma will prompt you to name the migration, e.g. "add_room_notes_column"
   ```
3. Regenerate the Prisma client so TypeScript types update:
   ```bash
   pnpm db:generate
   ```
4. If you changed RLS policies in `rls_and_triggers.sql`, re-apply them:
   ```bash
   pnpm apply:rls
   ```

### Adding a new API route

1. Create `apps/api/src/routes/your-feature.ts`
2. Register it in `apps/api/src/index.ts`:
   ```typescript
   import yourFeatureRouter from "./routes/your-feature";
   app.use("/api/your-feature", yourFeatureRouter);
   ```
3. Use `req.withTenant` inside route handlers to ensure RLS context:
   ```typescript
   router.get("/", authenticate, tenantMiddleware, async (req, res) => {
     const items = await req.withTenant((db) => db.yourModel.findMany());
     res.json(items);
   });
   ```

### Type safety

The codebase is fully TypeScript. Run type checks across all apps:

```bash
pnpm typecheck
```

Run linting:

```bash
pnpm lint
```

### Branch strategy

- `master` — main development branch
- Feature work: create a branch off `master`, e.g. `feature/housekeeping-ui`
- Merge back via pull request after review

---

## 14. Useful Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Start API + web in watch mode |
| `pnpm build` | Production build for all apps |
| `pnpm typecheck` | TypeScript type check across all packages |
| `pnpm lint` | ESLint across all packages |
| `pnpm db:migrate` | Create and apply a new migration |
| `pnpm db:generate` | Regenerate Prisma client after schema changes |
| `pnpm db:push` | Push schema changes without creating a migration file (prototype only) |
| `pnpm db:studio` | Open Prisma Studio at http://localhost:5555 |
| `pnpm db:seed` | Seed system roles into the database |
| `pnpm apply:rls` | Re-apply RLS security policies to PostgreSQL |
| `pnpm setup` | Full first-time setup (docker + migrate + rls + generate + seed), **in that order** |
| `pnpm fresh-setup` | Same as `pnpm setup`, but waits for Postgres to be healthy first instead of a blind sleep — use this on a new machine |
| `pnpm docker:up` | Start the PostgreSQL container |
| `pnpm docker:down` | Stop the PostgreSQL container |
| `pnpm docker:reset` | Wipe the database volume and restart fresh |

---

## 15. Troubleshooting

### "Cannot connect to database"
- Make sure Docker Desktop is running
- Run `pnpm docker:up` to start the Postgres container
- Check that port 5433 is not blocked by another process: `lsof -i :5433`

### "Prisma client not generated"
```bash
pnpm db:generate
```

### "Table does not exist"
Migrations have not been applied. Run:
```bash
pnpm db:migrate
```

### "Login returns 403 Access denied"
The seed has not been run. User roles must exist in the database:
```bash
pnpm db:seed
```

### "Port 5173 or 4000 already in use"
Another process is using that port. Find and stop it:
```bash
lsof -ti :4000 | xargs kill   # kills whatever is on port 4000
lsof -ti :5173 | xargs kill   # kills whatever is on port 5173
```

### "Migration drift detected" / a Y/N prompt during `db:migrate`
**Do not press N, and do not manually run `prisma migrate resolve --applied` to skip past it.** That command marks a migration as done in Prisma's history table *without running its SQL* — the migration is recorded as applied, but the tables/columns it was supposed to create never get created. This is exactly how `expenses`, `cash_accounts`, `ledger_entries`, and `whatsapp_briefing_logs` can end up missing on a machine that otherwise looks fully set up.

Drift happens when setup commands run out of order (e.g. `apply:rls` before `db:migrate` — RLS policies can only attach to tables that already exist) or when a half-finished setup is retried. It does not happen on a genuinely empty database. Fix it by wiping the volume and starting clean rather than resolving around it:
```bash
pnpm docker:reset && pnpm fresh-setup
```

### Reset everything and start fresh
```bash
pnpm docker:reset   # wipes DB volume, restarts container
pnpm fresh-setup    # re-runs migrate → RLS → generate → seed, in the correct order
```

---

## DBeaver Connection (Visual Database Browser)

If you want to browse the database visually:

1. Open DBeaver → **New Database Connection**
2. Select **PostgreSQL**
3. Enter:
   - Host: `localhost`
   - Port: `5433`
   - Database: `hotel_pms`
   - Username: `pms_user`
   - Password: `pms_pass`
4. Click **Test Connection** → should say "Connected"
5. Click **Finish**

> The ER diagram is available at `er_diagram.png` in the root of the repository for a visual overview of all tables and their relationships.
