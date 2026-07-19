import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { tenantMiddleware } from "../middleware/tenant";
import { requirePermission } from "../middleware/permission";
import {
  listReservationsSchema,
  createReservationSchema,
  updateReservationStatusSchema,
  updateReservationSchema,
} from "../schemas/reservations";
import { ReservationService } from "../services/ReservationService";
import { getPKTMonthRange } from "../lib/timezone";

const router: Router = Router();

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
  const { status } = updateReservationStatusSchema.parse(req.body);
  const updated = await ReservationService.updateStatus(req.withTenant, req.user!, id, status);
  res.json({ data: updated });
});

// PATCH /api/reservations/:id
router.patch("/:id", requirePermission("RESERVATION_UPDATE"), async (req, res) => {
  const id = req.params.id as string;
  const body = updateReservationSchema.parse(req.body);
  const updated = await ReservationService.update(req.withTenant, req.user!, id, body);
  res.json({ data: updated });
});

export default router;
