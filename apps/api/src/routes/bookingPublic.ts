/**
 * Public booking-engine routes — no authentication required.
 * Mounted at /api/public/booking in index.ts.
 *
 * Hotel context resolved from URL slug via adminPrisma.
 * All routes gate on the bookingEngine feature flag (returns 404 if disabled,
 * not 403, to avoid revealing that the hotel exists but is gated).
 */

import { Router } from "express";
import rateLimit from "express-rate-limit";
import { adminPrisma } from "@pms/db";
import { publicWithTenant } from "../lib/publicTenant";
import { checkFeatureAccess } from "../lib/subscription";
import { RoomService } from "../services/RoomService";
import { RatePlanService } from "../services/RatePlanService";
import { NotificationService } from "../services/NotificationService";
import { generateGroupRef } from "../services/GroupService";
import { notifyHotelDataChanged } from "../lib/realtime";
import {
  bookingAvailabilitySchema,
  publicSuggestRateSchema,
  publicPromoCodeSchema,
  createBookingRequestSchema,
  bookMultiSchema,
} from "../schemas/bookingPublic";
import { AppError } from "../utils/AppError";

const router: Router = Router();

// Tighter rate limit on the booking submission endpoint only.
const bookSubmitLimit = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip ?? "unknown",
  message: { error: "Too many booking requests from this IP. Please try again later." },
});

// ── Shared: resolve hotel from slug + check feature gate ─────────────────────

async function resolveAndGate(slug: string) {
  const hotel = await adminPrisma.hotel.findUnique({
    where:  { slug },
    select: {
      id: true, name: true, description: true, amenities: true,
      city: true, address: true, phone: true, whatsappNumber: true,
      propertyType: true, settings: true, isActive: true,
      cancellationPolicy: true, bookingPaymentTerms: true,
    },
  });
  if (!hotel?.isActive) return null;
  try {
    await checkFeatureAccess(hotel.id, "bookingEngine");
  } catch {
    // Feature disabled — respond 404 so public callers can't enumerate gated hotels
    return null;
  }
  return hotel;
}

// GET /api/public/booking/:hotelSlug — hotel info for public landing page
router.get("/:hotelSlug", async (req, res) => {
  const hotel = await resolveAndGate(req.params.hotelSlug as string);
  if (!hotel) { res.status(404).json({ error: "Hotel not found" }); return; }

  const s = (hotel.settings ?? {}) as Record<string, unknown>;
  const VALID_THEMES = ["WARM_CLAY", "PINE_TEAL", "AZURE_SLATE", "INDIGO_NIGHT"];
  const themeKey = VALID_THEMES.includes(s.themeKey as string) ? (s.themeKey as string) : "WARM_CLAY";
  res.json({
    data: {
      name:           hotel.name,
      description:    hotel.description,
      amenities:      hotel.amenities,
      city:           hotel.city,
      address:        hotel.address,
      phone:          hotel.phone,
      whatsappNumber: hotel.whatsappNumber,
      propertyType:   hotel.propertyType,
      logoUrl:        (s.logoUrl as string | undefined) ?? null,
      themeKey,
      cancellationPolicy:  hotel.cancellationPolicy,
      bookingPaymentTerms: hotel.bookingPaymentTerms,
    },
  });
});

// GET /api/public/booking/:hotelSlug/room-types — active room types for listing
router.get("/:hotelSlug/room-types", async (req, res) => {
  const hotel = await resolveAndGate(req.params.hotelSlug as string);
  if (!hotel) { res.status(404).json({ error: "Hotel not found" }); return; }

  const wt = publicWithTenant(hotel.id);
  const roomTypes = await wt((db) =>
    db.roomType.findMany({
      where: { isActive: true },
      select: {
        id: true, name: true, description: true, typeName: true,
        maxOccupancy: true, defaultRate: true, photoUrls: true,
        amenities: true, sortOrder: true,
      },
      orderBy: { sortOrder: "asc" },
    })
  );

  res.json({
    data: roomTypes.map((rt) => ({
      ...rt,
      defaultRate: rt.defaultRate / 100, // paisas → PKR
    })),
  });
});

// GET /api/public/booking/:hotelSlug/availability?checkIn&checkOut
// Returns available room count per room type (no individual room IDs exposed).
router.get("/:hotelSlug/availability", async (req, res) => {
  const hotel = await resolveAndGate(req.params.hotelSlug as string);
  if (!hotel) { res.status(404).json({ error: "Hotel not found" }); return; }

  const query = bookingAvailabilitySchema.parse(req.query);
  const wt    = publicWithTenant(hotel.id);

  const roomTypes = await wt((db) =>
    db.roomType.findMany({
      where:  { isActive: true },
      select: { id: true, name: true },
    })
  );

  const results = await Promise.all(
    roomTypes.map(async (rt) => {
      const avail = await RoomService.checkAvailability(wt, {
        checkInDate:  query.checkIn,
        checkOutDate: query.checkOut,
        roomTypeId:   rt.id,
      });
      return {
        roomTypeId:     rt.id,
        roomTypeName:   rt.name,
        availableCount: avail.availableRoomIds.length,
      };
    })
  );

  res.json({ data: results });
});

// GET /api/public/booking/:hotelSlug/suggest-rate?roomTypeId&checkIn&checkOut
// Returns the suggested nightly rate in PKR (not paisas).
router.get("/:hotelSlug/suggest-rate", async (req, res) => {
  const hotel = await resolveAndGate(req.params.hotelSlug as string);
  if (!hotel) { res.status(404).json({ error: "Hotel not found" }); return; }

  const query  = publicSuggestRateSchema.parse(req.query);
  const result = await RatePlanService.suggestRatePublic(hotel.id, {
    roomTypeId:     query.roomTypeId,
    checkIn:        query.checkIn,
    checkOut:       query.checkOut,
    bookingContext: "SINGLE",
    promoCode:      query.promoCode,
  });

  res.json({
    data: {
      suggestedRate: result.suggestedRate / 100, // paisas → PKR
      matchedPlan:   result.matchedPlan,
      appliedCode:   result.appliedCode,
    },
  });
});

// GET /api/public/booking/:hotelSlug/promo-code?code&checkIn&checkOut
router.get("/:hotelSlug/promo-code", async (req, res) => {
  const hotel = await resolveAndGate(req.params.hotelSlug as string);
  if (!hotel) { res.status(404).json({ error: "Hotel not found" }); return; }

  const query = publicPromoCodeSchema.parse(req.query);
  const data = await RatePlanService.validateAccessCodePublic(hotel.id, query.code, query.checkIn, query.checkOut);
  res.json({ data });
});

// POST /api/public/booking/:hotelSlug/book — submit a booking request (ENQUIRY)
router.post("/:hotelSlug/book", bookSubmitLimit, async (req, res) => {
  const hotel = await resolveAndGate(req.params.hotelSlug as string);
  if (!hotel) { res.status(404).json({ error: "Hotel not found" }); return; }

  const dto = createBookingRequestSchema.parse(req.body);
  const hasBookingTerms = Boolean(hotel.cancellationPolicy || hotel.bookingPaymentTerms);
  if (hasBookingTerms && !dto.termsAccepted) {
    throw new AppError(400, "Please accept the cancellation policy and booking terms before submitting.");
  }
  const wt  = publicWithTenant(hotel.id);

  // Fetch suggested rate before the transaction (read-only, no atomicity needed).
  const rateResult   = await RatePlanService.suggestRatePublic(hotel.id, {
    roomTypeId:     dto.roomTypeId,
    checkIn:        dto.checkInDate,
    checkOut:       dto.checkOutDate,
    bookingContext: "SINGLE",
    promoCode:      dto.promoCode,
  });
  const baseRateResult = dto.promoCode
    ? await RatePlanService.suggestRatePublic(hotel.id, {
      roomTypeId: dto.roomTypeId,
      checkIn: dto.checkInDate,
      checkOut: dto.checkOutDate,
      bookingContext: "SINGLE",
    })
    : null;
  const ratePerNight = rateResult.suggestedRate; // in paisas
  const nights       = Math.ceil(
    (new Date(dto.checkOutDate).getTime() - new Date(dto.checkInDate).getTime()) / (1000 * 60 * 60 * 24)
  );
  const totalAmount = ratePerNight * nights;
  const discountAmount = baseRateResult
    ? Math.max(0, baseRateResult.suggestedRate - ratePerNight) * nights
    : 0;

  // Single transaction: re-verify availability + guest upsert + reservation + audit + notify
  const reservation = await wt(async (db) => {
    // 1. Re-verify availability inline (atomic with reservation creation)
    const allRooms = await db.room.findMany({
      where:  { roomTypeId: dto.roomTypeId, isActive: true },
      select: { id: true },
    });
    if (allRooms.length === 0) {
      throw new AppError(409, "No rooms of this type exist at this hotel.");
    }
    const bookedRoomIds = await db.reservationRoom.findMany({
      where: {
        roomId:      { in: allRooms.map((r) => r.id) },
        checkInDate:  { lt: new Date(dto.checkOutDate) },
        checkOutDate: { gt: new Date(dto.checkInDate) },
        reservation:  { status: { notIn: ["CANCELLED", "CHECKED_OUT", "NO_SHOW"] } },
      },
      select: { roomId: true },
    });
    const bookedSet  = new Set(bookedRoomIds.map((r) => r.roomId));
    const freeRoom   = allRooms.find((r) => !bookedSet.has(r.id));
    if (!freeRoom) {
      throw new AppError(409, "No rooms available for the selected dates. Please choose different dates.");
    }

    // 2. Upsert guest — phone first, then email, else create new.
    // If a match is found but the submitted name differs from the stored name,
    // we do NOT overwrite the canonical Guest record. bookingContactName is set
    // on the Reservation instead so staff can see who actually submitted the form.
    let guest = await db.guest.findFirst({
      where:  { phone: dto.guestPhone },
      select: { id: true, fullName: true },
    });
    if (!guest && dto.guestEmail) {
      guest = await db.guest.findFirst({
        where:  { email: dto.guestEmail },
        select: { id: true, fullName: true },
      });
    }

    let bookingContactName: string | null = null;

    if (!guest) {
      const parts     = dto.guestName.trim().split(/\s+/);
      const firstName = parts[0];
      // Empty string for lastName when single-word name: the DB trigger sets
      // full_name = TRIM(first_name || ' ' || last_name), so lastName=firstName
      // would produce "Name Name". An empty lastName gives just "Name".
      const lastName  = parts.length > 1 ? parts.slice(1).join(" ") : "";
      guest = await db.guest.create({
        data: {
          hotelId:   hotel.id,
          firstName,
          lastName,
          fullName:  dto.guestName.trim(),
          phone:     dto.guestPhone,
          email:     dto.guestEmail ?? null,
        },
        select: { id: true, fullName: true },
      });
    } else {
      // Matched existing guest — record submitted name only if it differs
      if (dto.guestName.trim().toLowerCase() !== (guest.fullName ?? "").trim().toLowerCase()) {
        bookingContactName = dto.guestName.trim();
      }
    }

    // 3. Create reservation — status ENQUIRY, source BOOKING_ENGINE
    // confirmationNumber is required but "" is valid; a DB trigger overwrites with generated number
    const newReservation = await db.reservation.create({
      data: {
        hotelId:            hotel.id,
        guestId:            guest.id,
        confirmationNumber: "",
        status:             "ENQUIRY",
        source:             "BOOKING_ENGINE",
        bookingContactName,
        checkInDate:     new Date(dto.checkInDate),
        checkOutDate:    new Date(dto.checkOutDate),
        adults:          dto.adults,
        children:        dto.children,
        specialRequests: dto.specialRequests ?? null,
        quotedRate:      ratePerNight,
        totalAmount,
        discountAmount,
        appliedRatePlanName: rateResult.matchedPlan?.name ?? null,
        promoCode:        rateResult.appliedCode,
        cancellationPolicySnapshot:  hotel.cancellationPolicy,
        bookingPaymentTermsSnapshot: hotel.bookingPaymentTerms,
        termsAcceptedAt: hasBookingTerms ? new Date() : null,
        balanceDue:      totalAmount,
        rooms: {
          create: {
            roomId:      freeRoom.id,
            roomTypeId:  dto.roomTypeId,
            ratePerNight,
            checkInDate:  new Date(dto.checkInDate),
            checkOutDate: new Date(dto.checkOutDate),
          },
        },
      },
      select: { id: true, confirmationNumber: true, status: true },
    });

    // 4. Audit log — userId null (guest-initiated, no staff actor)
    await db.auditLog.create({
      data: {
        hotelId:  hotel.id,
        userId:   null,
        action:   "RESERVATION_CREATE",
        entity:   "reservation",
        entityId: newReservation.id,
        after:    JSON.parse(JSON.stringify({ source: "BOOKING_ENGINE", channel: "public" })),
      },
    });

    // 5. Notify hotel staff (userId null broadcasts to all staff in-app)
    try {
      await NotificationService.createNotification(db, hotel.id, {
        title:      "New Online Booking Request",
        body:       `${dto.guestName} requested ${newReservation.confirmationNumber} via Booking Engine`,
        type:       "BOOKING_REQUEST",
        entityId:   newReservation.id,
        entityType: "reservation",
        userId:     null,
      });
    } catch { /* notifications are non-critical — never block booking creation */ }

    return newReservation;
  });

  notifyHotelDataChanged(hotel.id, "reservation_created");

  res.status(201).json({
    data: {
      confirmationNumber: reservation.confirmationNumber,
      status:             "ENQUIRY",
      message:            "Your booking request has been received. The hotel will confirm your reservation shortly.",
    },
  });
});

// POST /api/public/booking/:hotelSlug/book-multi — multi-room booking request
// All items in ONE atomic transaction. Fails entire request if any room type
// lacks sufficient availability — no partial bookings ever created.
router.post("/:hotelSlug/book-multi", bookSubmitLimit, async (req, res) => {
  const hotel = await resolveAndGate(req.params.hotelSlug as string);
  if (!hotel) { res.status(404).json({ error: "Hotel not found" }); return; }

  const dto = bookMultiSchema.parse(req.body);
  const hasBookingTerms = Boolean(hotel.cancellationPolicy || hotel.bookingPaymentTerms);
  if (hasBookingTerms && !dto.termsAccepted) {
    throw new AppError(400, "Please accept the cancellation policy and booking terms before submitting.");
  }
  const wt  = publicWithTenant(hotel.id);

  // Compute total number of reservations to decide whether to create a GroupBooking
  const totalRooms = dto.items.reduce((s, i) => s + i.quantity, 0);
  const useGroup   = totalRooms > 1;
  const nights     = Math.ceil(
    (new Date(dto.checkOutDate).getTime() - new Date(dto.checkInDate).getTime()) / (1000 * 60 * 60 * 24)
  );

  // Fetch suggested rates for each room type (read-only, outside transaction)
  const rateMap = new Map<string, {
    ratePerNight: number;
    baseRatePerNight: number;
    appliedRatePlanName: string | null;
    appliedCode: string | null;
  }>();
  const roomTypeNameMap = new Map<string, string>();
  await Promise.all(dto.items.map(async (item) => {
    const rr = await RatePlanService.suggestRatePublic(hotel.id, {
      roomTypeId:     item.roomTypeId,
      checkIn:        dto.checkInDate,
      checkOut:       dto.checkOutDate,
      bookingContext: "SINGLE",
      promoCode:      dto.promoCode,
    });
    const baseRate = dto.promoCode
      ? await RatePlanService.suggestRatePublic(hotel.id, {
        roomTypeId: item.roomTypeId,
        checkIn: dto.checkInDate,
        checkOut: dto.checkOutDate,
        bookingContext: "SINGLE",
      })
      : null;
    rateMap.set(item.roomTypeId, {
      ratePerNight: rr.suggestedRate,
      baseRatePerNight: baseRate?.suggestedRate ?? rr.suggestedRate,
      appliedRatePlanName: rr.matchedPlan?.name ?? null,
      appliedCode: rr.appliedCode,
    });
  }));

  const result = await wt(async (db) => {
    // 1. Verify availability for every requested room type + quantity (atomic)
    const allocationSlots: Array<{ roomTypeId: string; capacity: number }> = [];
    for (const item of dto.items) {
      const allRooms = await db.room.findMany({
        where:  { roomTypeId: item.roomTypeId, isActive: true },
        select: { id: true, roomType: { select: { name: true, maxOccupancy: true } } },
      });
      if (allRooms.length === 0) {
        throw new AppError(409, `No rooms of the requested type exist at this hotel.`);
      }
      roomTypeNameMap.set(item.roomTypeId, allRooms[0].roomType.name);
      const bookedIds = await db.reservationRoom.findMany({
        where: {
          roomId:      { in: allRooms.map((r) => r.id) },
          checkInDate:  { lt: new Date(dto.checkOutDate) },
          checkOutDate: { gt: new Date(dto.checkInDate) },
          reservation:  { status: { notIn: ["CANCELLED", "CHECKED_OUT", "NO_SHOW"] } },
        },
        select: { roomId: true },
      });
      const bookedSet   = new Set(bookedIds.map((r) => r.roomId));
      const freeRooms   = allRooms.filter((r) => !bookedSet.has(r.id));
      if (freeRooms.length < item.quantity) {
        throw new AppError(409, `Only ${freeRooms.length} room(s) available for ${allRooms[0].roomType.name} (${item.quantity} requested).`);
      }
      for (let index = 0; index < item.quantity; index += 1) {
        allocationSlots.push({ roomTypeId: item.roomTypeId, capacity: allRooms[0].roomType.maxOccupancy });
      }
    }

    const totalCapacity = allocationSlots.reduce((sum, slot) => sum + slot.capacity, 0);
    if (dto.adults + dto.children > totalCapacity) {
      throw new AppError(400, "The selected rooms do not have enough capacity for all guests.");
    }

    // The public cart carries one party total. Spread it across the individual
    // reservations so a four-adult/two-room booking does not incorrectly write
    // four adults on every room record.
    let adultsRemaining = dto.adults;
    let childrenRemaining = dto.children ?? 0;
    const allocationsByRoomType = new Map<string, Array<{ adults: number; children: number }>>();
    for (const slot of allocationSlots) {
      const adults = Math.min(slot.capacity, adultsRemaining);
      adultsRemaining -= adults;
      const children = Math.min(slot.capacity - adults, childrenRemaining);
      childrenRemaining -= children;
      const existing = allocationsByRoomType.get(slot.roomTypeId) ?? [];
      existing.push({ adults, children });
      allocationsByRoomType.set(slot.roomTypeId, existing);
    }

    // 2. Guest upsert (same logic as /book)
    let guest = await db.guest.findFirst({ where: { phone: dto.guestPhone }, select: { id: true, fullName: true } });
    if (!guest && dto.guestEmail) {
      guest = await db.guest.findFirst({ where: { email: dto.guestEmail }, select: { id: true, fullName: true } });
    }
    let bookingContactName: string | null = null;
    if (!guest) {
      const parts     = dto.guestName.trim().split(/\s+/);
      const firstName = parts[0];
      const lastName  = parts.length > 1 ? parts.slice(1).join(" ") : "";
      guest = await db.guest.create({
        data: { hotelId: hotel.id, firstName, lastName, fullName: dto.guestName.trim(), phone: dto.guestPhone, email: dto.guestEmail ?? null },
        select: { id: true, fullName: true },
      });
    } else {
      if (dto.guestName.trim().toLowerCase() !== (guest.fullName ?? "").trim().toLowerCase()) {
        bookingContactName = dto.guestName.trim();
      }
    }

    // 3. Create GroupBooking if multi-room (pure linking mechanism, no agency semantics)
    let groupId: string | null = null;
    let groupRefResult: string | null = null;
    if (useGroup) {
      const groupRef = await generateGroupRef(db, hotel.id);
      const group = await db.groupBooking.create({
        data: {
          hotelId:    hotel.id,
          name:       `Online Multi-Room – ${dto.guestName.trim()}`,
          groupRef,
          payerType:  "INDIVIDUAL",
          billingType: "SPLIT",
          notes: JSON.stringify({
            status:         "ENQUIRY",
            checkInDate:    dto.checkInDate,
            checkOutDate:   dto.checkOutDate,
            totalRooms,
            paymentTerms:   "CASH",
            advancePaid:    0,
            negotiatedRate: 0,
            internalNotes:  "",
          }),
        },
        select: { id: true, groupRef: true },
      });
      groupId = group.id;
      groupRefResult = group.groupRef;
    }

    // 4. Create all reservations
    const createdReservations: { id: string; confirmationNumber: string; roomTypeName: string }[] = [];
    for (const item of dto.items) {
      // Re-fetch available rooms (still within the same transaction)
      const allRooms = await db.room.findMany({
        where:  { roomTypeId: item.roomTypeId, isActive: true },
        select: { id: true },
      });
      const bookedIds = await db.reservationRoom.findMany({
        where: {
          roomId:      { in: allRooms.map((r) => r.id) },
          checkInDate:  { lt: new Date(dto.checkOutDate) },
          checkOutDate: { gt: new Date(dto.checkInDate) },
          reservation:  { status: { notIn: ["CANCELLED", "CHECKED_OUT", "NO_SHOW"] } },
        },
        select: { roomId: true },
      });
      const bookedSet = new Set(bookedIds.map((r) => r.roomId));
      const freeRooms = allRooms.filter((r) => !bookedSet.has(r.id));
      const rateInfo = rateMap.get(item.roomTypeId);
      const ratePerNight = rateInfo?.ratePerNight ?? 0;
      const totalAmount  = ratePerNight * nights;
      const discountAmount = rateInfo
        ? Math.max(0, rateInfo.baseRatePerNight - ratePerNight) * nights
        : 0;

      for (let q = 0; q < item.quantity; q++) {
        const freeRoom = freeRooms[q];
        if (!freeRoom) throw new AppError(409, `Availability changed mid-transaction — please try again.`);
        const guestAllocation = allocationsByRoomType.get(item.roomTypeId)?.shift();
        if (!guestAllocation) throw new AppError(500, "Unable to allocate guests to selected rooms.");
        const newRes = await db.reservation.create({
          data: {
            hotelId:            hotel.id,
            guestId:            guest!.id,
            confirmationNumber: "",
            status:             "ENQUIRY",
            source:             "BOOKING_ENGINE",
            bookingContactName,
            checkInDate:     new Date(dto.checkInDate),
            checkOutDate:    new Date(dto.checkOutDate),
            adults:          guestAllocation.adults,
            children:        guestAllocation.children,
            specialRequests: dto.specialRequests ?? null,
            quotedRate:      ratePerNight,
            totalAmount,
            discountAmount,
            appliedRatePlanName: rateInfo?.appliedRatePlanName ?? null,
            promoCode:        rateInfo?.appliedCode ?? null,
            cancellationPolicySnapshot:  hotel.cancellationPolicy,
            bookingPaymentTermsSnapshot: hotel.bookingPaymentTerms,
            termsAcceptedAt: hasBookingTerms ? new Date() : null,
            balanceDue:      totalAmount,
            ...(groupId ? { groupId } : {}),
            rooms: {
              create: {
                roomId:      freeRoom.id,
                roomTypeId:  item.roomTypeId,
                ratePerNight,
                checkInDate:  new Date(dto.checkInDate),
                checkOutDate: new Date(dto.checkOutDate),
              },
            },
          },
          select: { id: true, confirmationNumber: true },
        });
        createdReservations.push({
          id:                 newRes.id,
          confirmationNumber: newRes.confirmationNumber,
          roomTypeName:       roomTypeNameMap.get(item.roomTypeId) ?? "Room",
        });
        await db.auditLog.create({
          data: {
            hotelId:  hotel.id,
            userId:   null,
            action:   "RESERVATION_CREATE",
            entity:   "reservation",
            entityId: newRes.id,
            after:    JSON.parse(JSON.stringify({ source: "BOOKING_ENGINE", channel: "public", multiRoom: useGroup })),
          },
        });
      }
    }

    // 5. Notify staff
    const notifBody = useGroup
      ? `${dto.guestName} requested ${totalRooms} rooms via Booking Engine`
      : `${dto.guestName} requested ${createdReservations[0]?.confirmationNumber} via Booking Engine`;
    try {
      await NotificationService.createNotification(db, hotel.id, {
        title:      useGroup ? "New Multi-Room Booking Request" : "New Online Booking Request",
        body:       notifBody,
        type:       "BOOKING_REQUEST",
        entityId:   useGroup ? (groupId ?? hotel.id) : (createdReservations[0]?.id ?? hotel.id),
        entityType: useGroup ? "group" : "reservation",
        userId:     null,
      });
    } catch { /* non-critical */ }

    return { createdReservations, groupId, groupRef: groupRefResult };
  });

  notifyHotelDataChanged(hotel.id, "reservation_created");

  const confirmationReference = useGroup
    ? (result.groupRef ?? result.createdReservations[0]?.confirmationNumber)
    : result.createdReservations[0]?.confirmationNumber;

  res.status(201).json({
    data: {
      confirmationReference,
      rooms:   result.createdReservations,
      status:  "ENQUIRY",
      message: "Your booking request has been received. The hotel will confirm your reservation shortly.",
    },
  });
});

export default router;
