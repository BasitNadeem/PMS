# Backend Rules — apps/api

## Directory layout

```
src/
  routes/         # HTTP interface only — parse request, call service, send response
  services/       # Business logic — no Express types (Request/Response) ever
  schemas/        # Zod validation schemas, one file per resource
  middleware/     # auth, tenant, permission, error, requestId
  lib/
    env.ts        # Validated env vars (Zod) — only place process.env is read
    logger.ts     # Structured logger (pino or morgan wrapper)
  types/          # Shared TS types; Express Request augmentation
  utils/          # Pure functions: pagination, slugify, date helpers
```

## JWT payload — add permissions

The current `JwtPayload` only has `{ userId, hotelId, role }`. Add `permissions: string[]` so `requirePermission` middleware can work without a DB lookup on every request.

Update `src/middleware/auth.ts`:
```ts
export interface JwtPayload {
  userId: string;
  hotelId: string;
  role: string;
  permissions: string[]; // ← add this
}
```

Update `src/routes/auth.ts` sign call:
```ts
const accessToken = jwt.sign(
  { userId: user.id, hotelId: hotel.id, role: hotelUser.role, permissions },
  env.JWT_SECRET,
  { expiresIn: env.JWT_EXPIRES_IN }
);
```

Without this, `req.user?.permissions` is always `undefined` and `requirePermission` silently allows everything.

---

## errorHandler — add AppError case

The existing `errorHandler` in `src/middleware/error.ts` must handle `AppError`:
```ts
import { AppError } from "../utils/AppError";

export function errorHandler(err, _req, res, _next) {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message, ...(err.details && { details: err.details }) });
    return;
  }
  // ... existing ZodError, Prisma cases ...
}
```
Add this case **before** the ZodError check.

---

## Route → Service → Prisma layering

```
Route handler
  1. Parse & validate input with Zod schema (from schemas/)
  2. Call service function
  3. Send standardized response

Service function
  1. Business rules + authorization checks
  2. DB access via req.withTenant (tenant) or adminPrisma (cross-tenant)
  3. Return typed result — never Response/Request types

Route handler never contains Prisma calls.
Service functions never import express or Response/Request.
```

---

## Route template
```ts
// routes/reservations.ts
import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { tenantMiddleware } from "../middleware/tenant";
import { requirePermission } from "../middleware/permission";
import { createReservationSchema, listReservationsSchema } from "../schemas/reservations";
import { ReservationService } from "../services/ReservationService";

const router = Router();
router.use(authenticate, tenantMiddleware);

router.get(
  "/",
  requirePermission("RESERVATION_READ"),
  async (req, res) => {
    const query = listReservationsSchema.parse(req.query);
    const result = await ReservationService.list(req.withTenant, query);
    res.json(result);
  }
);

router.post(
  "/",
  requirePermission("RESERVATION_CREATE"),
  async (req, res) => {
    const body = createReservationSchema.parse(req.body);
    const reservation = await ReservationService.create(req.withTenant, req.user!, body);
    res.status(201).json({ data: reservation });
  }
);

export default router;
```

---

## Service template
```ts
// services/ReservationService.ts
import type { TenantTx } from "@pms/db";
import type { JwtPayload } from "../middleware/auth";
import type { CreateReservationDto, ListReservationsQuery } from "../schemas/reservations";
import { AppError } from "../utils/AppError";
import { paginationMeta } from "../utils/pagination";

type WithTenantFn = <T>(fn: (db: TenantTx) => Promise<T>) => Promise<T>;

export const ReservationService = {
  async list(withTenant: WithTenantFn, query: ListReservationsQuery) {
    const skip = (query.page - 1) * query.limit;
    const [items, total] = await withTenant((db) =>
      Promise.all([
        db.reservation.findMany({ /* filters */ skip, take: query.limit }),
        db.reservation.count({ /* same filters */ }),
      ])
    );
    return { data: items, meta: paginationMeta(total, query.page, query.limit) };
  },

  async create(withTenant: WithTenantFn, actor: JwtPayload, dto: CreateReservationDto) {
    // Availability check and insert must be in ONE withTenant callback to avoid a race condition
    // where a room is booked between the check and the insert.
    return withTenant(async (db) => {
      const conflict = await db.reservationRoom.findFirst({
        where: {
          roomId: dto.roomId,
          checkInDate:  { lt: new Date(dto.checkOutDate) },
          checkOutDate: { gt: new Date(dto.checkInDate) },
          reservation:  { status: { not: "CANCELLED" } },
        },
      });
      if (conflict) throw new AppError(409, "Room is not available for the selected dates");

      const reservation = await db.reservation.create({
        data: {
          hotelId: actor.hotelId,
          guestId: dto.guestId,
          checkInDate:  new Date(dto.checkInDate),
          checkOutDate: new Date(dto.checkOutDate),
          adults:  dto.adults,
          children: dto.children,
          source:  dto.source,
          quotedRate: dto.ratePerNight,
          rooms: { create: { roomId: dto.roomId, roomTypeId: dto.roomTypeId, ratePerNight: dto.ratePerNight, checkInDate: new Date(dto.checkInDate), checkOutDate: new Date(dto.checkOutDate) } },
        },
        include: { rooms: true },
      });

      await db.auditLog.create({
        data: {
          hotelId:  actor.hotelId,
          userId:   actor.userId,
          action:   "RESERVATION_CREATE",
          entity:   "reservation",
          entityId: reservation.id,
          meta:     { source: dto.source },
        },
      });

      return reservation;
    });
  },
};
```

---

## Zod schemas (one file per resource)
```ts
// schemas/reservations.ts
import { z } from "zod";
import { ReservationStatus, BookingSource } from "@pms/db";

export const listReservationsSchema = z.object({
  status: z.nativeEnum(ReservationStatus).optional(),
  date:   z.string().date().optional(),
  page:   z.coerce.number().int().min(1).default(1),
  limit:  z.coerce.number().int().min(1).max(100).default(20),
});
export type ListReservationsQuery = z.infer<typeof listReservationsSchema>;

export const createReservationSchema = z.object({
  guestId:      z.string().uuid(),
  checkInDate:  z.string().date(),
  checkOutDate: z.string().date(),
  roomId:       z.string().uuid(),
  roomTypeId:   z.string().uuid(),
  ratePerNight: z.number().int().positive(),
  adults:       z.number().int().min(1).default(1),
  children:     z.number().int().min(0).default(0),
  source:       z.nativeEnum(BookingSource).default("WALK_IN"),
  specialRequests: z.string().trim().optional(),
}).refine(
  (d) => new Date(d.checkOutDate) > new Date(d.checkInDate),
  { message: "Check-out must be after check-in", path: ["checkOutDate"] }
);
export type CreateReservationDto = z.infer<typeof createReservationSchema>;
```

**Rules for schemas:**
- Always export inferred types (`z.infer<typeof schema>`).
- Query strings use `z.coerce` for numbers/booleans (they arrive as strings).
- `.refine()` for cross-field business rules.
- String fields: always `.trim()`.
- UUID fields: always `.uuid()`.
- Schemas live in `schemas/` — never inline inside route files.

---

## AppError — domain error class
```ts
// utils/AppError.ts
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "AppError";
  }
}
```

**Usage:** `throw new AppError(409, "Room not available")` anywhere in services.
**Never** call `res.status().json()` from inside a service.

The `errorHandler` middleware handles:
- `AppError` → `{ error: message, details? }`
- `ZodError` → `400 { error: "Validation error", details: issues }`
- `PrismaClientKnownRequestError P2002` → `409`
- `PrismaClientKnownRequestError P2025` → `404`
- Unknown → `500`

---

## Permission middleware
```ts
// middleware/permission.ts
import type { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/AppError";

export function requirePermission(key: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    // req.user.permissions is populated from the JWT — see JWT payload section above.
    // If permissions are missing the token was issued before the field was added; treat as denied.
    if (!req.user?.permissions?.includes(key)) {
      throw new AppError(403, `Missing permission: ${key}`);
    }
    next();
  };
}
```

- Every mutating route **must** have `requirePermission("RESOURCE_ACTION")`.
- Permission keys follow `RESOURCE_ACTION` — e.g. `RESERVATION_CREATE`, `GUEST_UPDATE`, `ROOM_DELETE`.
- Add new permission keys to the seed and permissions table before using them in code.

---

## Response format (enforced everywhere)

```ts
// Success — single item
res.json({ data: item });

// Success — list with pagination
res.json({ data: items, meta: { total, page, limit } });

// Created
res.status(201).json({ data: item });

// No content (delete)
res.status(204).send();
```

Never return bare arrays or objects directly — always wrapped in `{ data }`.

---

## Audit logging

Every **write** operation (create / update / delete / status change) **must** create an audit log entry **inside the same `withTenant` callback** as the mutation — never in a separate call after the fact.

Action naming convention: `ENTITY_VERB` — e.g. `RESERVATION_CREATE`, `GUEST_UPDATE`, `ROOM_DELETE`, `RESERVATION_CHECKIN`.

See the service template above for the full pattern — the `create` example already includes the audit log inside the single `withTenant` callback.

---

## Prisma / database rules

- **Tenant routes**: always use `req.withTenant(db => ...)` — never import `prisma` directly.
- **Admin/cross-tenant routes** (auth, super-admin): use `adminPrisma` from `@pms/db`.
- **Soft deletes**: use `deletedAt` timestamp; never hard-delete guest or user records.
- **Transactions**: wrap multi-step writes in a single `withTenant` callback (Prisma interactive transactions are supported).
- **Select only needed fields**: use `select` or `include` explicitly — never return full rows with sensitive columns (`passwordHash`, `refreshTokenHash`).
- **Never** call `$queryRaw` unless there is a documented reason (e.g. RLS set call).

---

## Pagination helper
```ts
// utils/pagination.ts
export function paginationMeta(total: number, page: number, limit: number) {
  return { total, page, limit, totalPages: Math.ceil(total / limit) };
}
```

Always use this helper to build the `meta` object — keeps the shape consistent.

---

## TypeScript conventions
- `interface` for object shapes; `type` for unions and utility types.
- All service functions are typed — no implicit `any` in return types.
- Extend Express `Request` in `src/types/express.d.ts` — already done for `req.user` and `req.withTenant`.
- DTO types come from `z.infer<typeof schema>` — never duplicate by hand.

---

## Error handling rules
- Route handlers do not try/catch — `express-async-errors` + `errorHandler` handle it globally.
- Only catch errors you can **meaningfully handle** (e.g. token decode failure in auth routes).
- Log unexpected errors at `error` level with full stack trace.
- Do not expose internal error messages in production responses.

---

## Env var rules
- All env vars declared and validated in `lib/env.ts` with Zod.
- `process.env` is **only accessed** inside `lib/env.ts`.
- Everywhere else, import `{ env }` from `../lib/env`.
- Add new vars to `lib/env.ts` and `.env.example` simultaneously.

---

## Security checklist (apply to every route)
- `authenticate` middleware on all routes except: `/api/health`, `/api/auth/login`, `/api/auth/refresh` (verifies its own refresh token), `/api/auth/logout` (best-effort, should work unauthenticated).
- `tenantMiddleware` after `authenticate` on all tenant-scoped routes.
- `requirePermission` on all write routes and sensitive reads.
- Rate limiting already applied globally to `/api/*` — tighten on auth routes:
  ```ts
  router.post("/login", rateLimit({ windowMs: 15 * 60 * 1000, max: 20 }), ...)
  ```
- Never log passwords, tokens, or `Authorization` headers.
- UUIDs for all resource IDs — never sequential integers exposed in URLs.

---

## Forbidden patterns
- Prisma calls inside route handlers — move to services.
- `res.json(rawPrismaObject)` — strip sensitive fields or use `select`.
- `process.env.X` outside `lib/env.ts`.
- `throw new Error("...")` for domain errors — use `AppError` with a status code.
- Inline Zod schemas in route files — put them in `schemas/`.
- Direct `import { prisma }` in route or service files for tenant-scoped operations — use `req.withTenant`.
