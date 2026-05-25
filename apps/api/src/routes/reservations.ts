import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { tenantMiddleware } from "../middleware/tenant";
import { requirePermission } from "../middleware/permission";
import { paginationMeta } from "../utils/pagination";
import {
  listReservationsSchema,
  createReservationSchema,
  updateReservationStatusSchema,
} from "../schemas/reservations";

const router = Router();

router.use(authenticate, tenantMiddleware);

// GET /api/reservations?status=CONFIRMED&date=2025-12-01
router.get("/", requirePermission("RESERVATION_READ"), async (req, res) => {
  const query = listReservationsSchema.parse(req.query);
  const skip  = (query.page - 1) * query.limit;

  const where = {
    ...(query.status && { status: query.status }),
    ...(query.date   && { checkInDate: new Date(query.date) }),
  };

  const [items, total] = await req.withTenant((db) =>
    Promise.all([
      db.reservation.findMany({
        where,
        include: {
          guest: { select: { id: true, fullName: true, phone: true, documentNumber: true } },
          rooms: { include: { room: { select: { number: true, floor: true } } } },
        },
        orderBy: { checkInDate: "asc" },
        skip,
        take: query.limit,
      }),
      db.reservation.count({ where }),
    ])
  );

  res.json({ data: items, meta: paginationMeta(total, query.page, query.limit) });
});

// GET /api/reservations/:id
router.get("/:id", requirePermission("RESERVATION_READ"), async (req, res) => {
  const id = req.params.id as string;
  const reservation = await req.withTenant((db) =>
    db.reservation.findUniqueOrThrow({
      where: { id },
      include: {
        guest: true,
        rooms: { include: { room: true, roomType: true } },
        folio: { include: { items: true } },
        payments: true,
      },
    })
  );
  res.json({ data: reservation });
});

// POST /api/reservations
router.post("/", requirePermission("RESERVATION_CREATE"), async (req, res) => {
  const body = createReservationSchema.parse(req.body);

  const reservation = await req.withTenant((db) =>
    db.reservation.create({
      data: {
        hotelId:            req.user!.hotelId,
        confirmationNumber: "", // DB trigger (trg_set_confirmation_number) fills this in
        guestId:            body.guestId,
        checkInDate:     new Date(body.checkInDate),
        checkOutDate:    new Date(body.checkOutDate),
        adults:          body.adults,
        children:        body.children,
        source:          body.source,
        specialRequests: body.specialRequests,
        quotedRate:      body.ratePerNight,
        rooms: {
          create: {
            roomId:       body.roomId,
            roomTypeId:   body.roomTypeId,
            ratePerNight: body.ratePerNight,
            checkInDate:  new Date(body.checkInDate),
            checkOutDate: new Date(body.checkOutDate),
          },
        },
      },
      include: { rooms: true },
    })
  );

  res.status(201).json({ data: reservation });
});

// PATCH /api/reservations/:id/status
router.patch("/:id/status", requirePermission("RESERVATION_UPDATE"), async (req, res) => {
  const id = req.params.id as string;
  const { status } = updateReservationStatusSchema.parse(req.body);

  const updated = await req.withTenant((db) =>
    db.reservation.update({
      where: { id },
      data:  { status },
    })
  );

  res.json({ data: updated });
});

export default router;
