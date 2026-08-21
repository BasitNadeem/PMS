import { Router } from "express";
import jwt from "jsonwebtoken";
import { authenticate, type JwtPayload } from "../middleware/auth";
import { tenantMiddleware } from "../middleware/tenant";
import { requirePermission } from "../middleware/permission";
import {
  listReservationsSchema,
  createReservationSchema,
  updateReservationStatusSchema,
  updateReservationSchema,
  manageCheckedInStaySchema,
  reverseReservationLifecycleSchema,
} from "../schemas/reservations";
import { ReservationService } from "../services/ReservationService";
import { GuestDocumentService } from "../services/GuestDocumentService";
import { ScanSessionService } from "../services/ScanSessionService";
import { getPKTMonthRange } from "../lib/timezone";
import { env } from "../lib/env";

const router: Router = Router();

// GET /api/reservations/id-capture/:token/events — desktop waits for the phone.
//
// Declared BEFORE the router-wide `authenticate` below, deliberately. EventSource
// cannot set an Authorization header, so the JWT arrives as ?auth= and is verified
// here by hand. Sitting behind the global guard would mean a 401 every time, before
// this handler ever ran — which is exactly what happens to the equivalent inventory
// scan route in routes/inventory.ts.
router.get("/id-capture/:token/events", async (req, res) => {
  const rawJwt = req.headers.authorization?.replace("Bearer ", "") ?? (req.query.auth as string | undefined);
  if (!rawJwt) { res.status(401).json({ error: "Unauthorized" }); return; }

  let payload: JwtPayload;
  try {
    payload = jwt.verify(rawJwt, env.JWT_SECRET) as JwtPayload;
  } catch {
    res.status(401).json({ error: "Invalid token" });
    return;
  }

  const token   = req.params.token as string;
  const session = await ScanSessionService.get(token);
  if (!session)                            { res.status(404).json({ error: "Session not found or expired" }); return; }
  if (session.hotelId !== payload.hotelId) { res.status(403).json({ error: "Forbidden" }); return; }
  if (session.purpose !== "GUEST_ID")      { res.status(403).json({ error: "Not an ID capture session" }); return; }

  // The phone can finish before the desktop finishes opening the stream.
  if (session.status === "done") {
    res.json({ data: session.result });
    return;
  }

  res.setHeader("Content-Type",  "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection",    "keep-alive");
  res.flushHeaders();
  res.write("event: connected\ndata: {}\n\n");

  ScanSessionService.registerSSE(token, res);

  const heartbeat = setInterval(() => res.write("event: ping\ndata: {}\n\n"), 30_000);
  res.on("close", () => clearInterval(heartbeat));
});

router.use(authenticate, tenantMiddleware);

// GET /api/reservations/counts — BEFORE /:id or Express matches "counts" as an id
router.get("/counts", requirePermission("RESERVATION_READ"), async (req, res) => {
  const result = await ReservationService.counts(req.withTenant);
  res.json({ data: result });
});

// GET /api/reservations/calendar?year=2026&month=6 — BEFORE /:id
router.get("/calendar", requirePermission("RESERVATION_READ"), async (req, res) => {
  const year  = parseInt(req.query.year  as string, 10);
  const month = parseInt(req.query.month as string, 10);

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    res.status(400).json({ error: "Invalid year or month" });
    return;
  }

  const { start: firstDay, end: lastDay } = getPKTMonthRange(year, month);

  const rows = await req.withTenant((db) =>
    db.reservation.findMany({
      where: {
        checkInDate:  { lte: lastDay },
        checkOutDate: { gte: firstDay },
      },
      include: {
        guest: { select: { fullName: true } },
        rooms: {
          include: {
            room:     { select: { id: true, number: true, floor: true } },
            roomType: { select: { name: true } },
          },
        },
      },
      orderBy: { checkInDate: "asc" },
    })
  );

  const data = rows.map((r) => ({
    id:                 r.id,
    confirmationNumber: r.confirmationNumber,
    status:             r.status,
    checkIn:            r.checkInDate.toISOString(),
    checkOut:           r.checkOutDate.toISOString(),
    totalAmount:        r.totalAmount,
    groupId:            r.groupId,
    isVip:              r.isVip,
    guest:              { fullName: r.guest.fullName },
    rooms:              r.rooms.map((rr) => ({
      roomId: rr.roomId,
      room: {
        id:       rr.room.id,
        number:   rr.room.number,
        floor:    rr.room.floor,
        roomType: { name: rr.roomType.name },
      },
    })),
  }));

  res.json({ data });
});

// GET /api/reservations
router.get("/", requirePermission("RESERVATION_READ"), async (req, res) => {
  const query = listReservationsSchema.parse(req.query);
  const result = await ReservationService.list(req.withTenant, query);
  res.json(result);
});

// GET /api/reservations/:id
router.get("/:id", requirePermission("RESERVATION_READ"), async (req, res) => {
  const id = req.params.id as string;
  const reservation = await ReservationService.get(req.withTenant, id);
  res.json({ data: reservation });
});

// POST /api/reservations
router.post("/", requirePermission("RESERVATION_CREATE"), async (req, res) => {
  const body = createReservationSchema.parse(req.body);
  const reservation = await ReservationService.create(req.withTenant, req.user!, body);
  res.status(201).json({ data: reservation });
});

// PATCH /api/reservations/:id/status
router.patch("/:id/status", requirePermission("RESERVATION_UPDATE"), async (req, res) => {
  const id = req.params.id as string;
  const { status, reason } = updateReservationStatusSchema.parse(req.body);
  const updated = await ReservationService.updateStatus(req.withTenant, req.user!, id, status, reason);
  res.json({ data: updated });
});

// POST /api/reservations/:id/manage-stay — explicit post-check-in workflow.
// Kept separate from ordinary reservation edits because room operations and
// folio adjustments must commit atomically.
router.post("/:id/manage-stay", requirePermission("RESERVATION_UPDATE"), async (req, res) => {
  const id = req.params.id as string;
  const body = manageCheckedInStaySchema.parse(req.body);
  const updated = await ReservationService.manageCheckedInStay(req.withTenant, req.user!, id, body);
  res.json({ data: updated });
});

// POST /api/reservations/:id/reverse-lifecycle — compensating correction for
// an accidental check-in or checkout. Original events remain in the audit log.
router.post("/:id/reverse-lifecycle", requirePermission("RESERVATION_REVERSE"), async (req, res) => {
  const id = req.params.id as string;
  const body = reverseReservationLifecycleSchema.parse(req.body);
  const updated = await ReservationService.reverseLifecycle(req.withTenant, req.user!, id, body);
  res.json({ data: updated });
});

// PATCH /api/reservations/:id
router.patch("/:id", requirePermission("RESERVATION_UPDATE"), async (req, res) => {
  const id = req.params.id as string;
  const body = updateReservationSchema.parse(req.body);
  const updated = await ReservationService.update(req.withTenant, req.user!, id, body);
  res.json({ data: updated });
});

// ── Guest ID capture ─────────────────────────────────────────────────────────

// POST /api/reservations/:id/id-capture/session — desktop mints the QR token
router.post("/:id/id-capture/session", requirePermission("RESERVATION_CHECKIN"), async (req, res) => {
  const id = req.params.id as string;

  // Read the guest through the tenant client so RLS proves this reservation
  // belongs to the caller's hotel before a token is minted against it.
  const reservation = await req.withTenant((db) =>
    db.reservation.findUnique({ where: { id }, select: { id: true, guestId: true } }),
  );
  if (!reservation) { res.status(404).json({ error: "Reservation not found" }); return; }

  const { token } = await ScanSessionService.create(req.user!.hotelId, "GUEST_ID", {
    reservationId: reservation.id,
    guestId:       reservation.guestId,
    userId:        req.user!.userId,
  });

  res.status(201).json({ data: { token } });
});

// GET /api/reservations/:id/documents — metadata only, never keys or URLs
router.get("/:id/documents", requirePermission("RESERVATION_READ"), async (req, res) => {
  const docs = await GuestDocumentService.listForReservation(req.withTenant, req.user!.hotelId, req.params.id as string);
  res.json({ data: docs });
});

export default router;
