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
import { adminPrisma, Prisma } from "@pms/db";
import type { TenantTx } from "@pms/db";
import { publicWithTenant } from "../lib/publicTenant";
import { checkFeatureAccess } from "../lib/subscription";
import { RoomService } from "../services/RoomService";
import { RatePlanService } from "../services/RatePlanService";
import { UpsellService } from "../services/UpsellService";
import { NotificationService } from "../services/NotificationService";
import { generateGroupRef } from "../services/GroupService";
import { notifyHotelDataChanged } from "../lib/realtime";
import { enqueueReservationEmail } from "../lib/reservationEmails";
import { queueChannexSync } from "../lib/channexSync";
import { calculateAccommodationCharges } from "../lib/accommodationCharges";
import {
  bookingAvailabilitySchema,
  publicSuggestRateSchema,
  publicPromoCodeSchema,
  createBookingRequestSchema,
  bookMultiSchema,
} from "../schemas/bookingPublic";
import { AppError } from "../utils/AppError";
import { assertPromoCodeGuest, consumePromoCode } from "../utils/promoCodes";
import type { BookMultiDto, CreateBookingRequestDto } from "../schemas/bookingPublic";

const router: Router = Router();

type PublicGuestCrmDto = Pick<
  CreateBookingRequestDto | BookMultiDto,
  "guestEmail" | "dateOfBirth" | "anniversaryDate" | "marketingOptIn"
>;

function crmDateParts(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return { year: year!, month: month!, day: day! };
}

/**
 * Adds volunteered CRM details to the matched guest without replacing data the
 * hotel already trusts. Public booking data is additive: a guest can fill a
 * missing birthday or anniversary and explicitly opt in, but cannot overwrite
 * an existing profile date from an unauthenticated form.
 */
async function applyPublicGuestCrm(
  db: TenantTx,
  hotelId: string,
  guestId: string,
  dto: PublicGuestCrmDto,
) {
  const existing = await db.guest.findUniqueOrThrow({
    where: { id: guestId },
    select: {
      email: true,
      dateOfBirth: true,
      marketingOptIn: true,
      specialDates: {
        where: { kind: { in: ["BIRTHDAY", "ANNIVERSARY"] } },
        select: { kind: true },
      },
    },
  });

  const hasBirthday = existing.specialDates.some((date) => date.kind === "BIRTHDAY");
  const hasAnniversary = existing.specialDates.some((date) => date.kind === "ANNIVERSARY");
  const emailCaptured = Boolean(!existing.email && dto.guestEmail);
  const birthDateCaptured = Boolean(!existing.dateOfBirth && dto.dateOfBirth);
  const birthdayAdded = Boolean(dto.dateOfBirth && !hasBirthday);
  const anniversaryAdded = Boolean(dto.anniversaryDate && !hasAnniversary);
  const consentCaptured = dto.marketingOptIn && !existing.marketingOptIn;

  if (emailCaptured || birthDateCaptured || consentCaptured) {
    await db.guest.update({
      where: { id: guestId },
      data: {
        ...(emailCaptured ? { email: dto.guestEmail } : {}),
        ...(birthDateCaptured
          ? { dateOfBirth: new Date(`${dto.dateOfBirth}T00:00:00.000Z`) }
          : {}),
        ...(consentCaptured ? { marketingOptIn: true, marketingOptInAt: new Date() } : {}),
      },
    });
  }

  const specialDates = [
    ...(birthdayAdded
      ? [{ hotelId, guestId, kind: "BIRTHDAY" as const, ...crmDateParts(dto.dateOfBirth!), source: "BOOKING_ENGINE" }]
      : []),
    ...(anniversaryAdded
      ? [{ hotelId, guestId, kind: "ANNIVERSARY" as const, ...crmDateParts(dto.anniversaryDate!), source: "BOOKING_ENGINE" }]
      : []),
  ];
  if (specialDates.length > 0) {
    await db.guestSpecialDate.createMany({ data: specialDates, skipDuplicates: true });
  }

  if (emailCaptured || birthdayAdded || anniversaryAdded || consentCaptured) {
    await db.auditLog.create({
      data: {
        hotelId,
        userId: null,
        action: "GUEST_PROFILE_UPDATED",
        entity: "guest",
        entityId: guestId,
        after: {
          source: "BOOKING_ENGINE",
          emailCaptured,
          birthdayAdded,
          anniversaryAdded,
          marketingOptInCaptured: consentCaptured,
        },
      },
    });
  }
}

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
      accommodationTax: {
        gstEnabled:   s.gstEnabled === true,
        gstRate:      typeof s.gstRate === "number" ? s.gstRate : 0,
        pstEnabled:   s.pstEnabled === true,
        pstRate:      typeof s.pstRate === "number" ? s.pstRate : 0,
        taxInclusive: s.taxInclusive === true,
      },
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
      baseRate:      result.baseRate / 100,
      matchedPlan:   result.matchedPlan,
      appliedCode:   result.appliedCode,
      discountPercent: result.discountPercent,
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

// GET /api/public/booking/:hotelSlug/upsells — this hotel's bookable extras
router.get("/:hotelSlug/upsells", async (req, res) => {
  const hotel = await resolveAndGate(req.params.hotelSlug as string);
  if (!hotel) { res.status(404).json({ error: "Hotel not found" }); return; }

  const upsells = await UpsellService.listActiveUpsellsPublic(hotel.id);
  res.json({
    data: upsells.map((u) => ({
      ...u,
      amount: u.amount / 100, // paisas → PKR
    })),
  });
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
  const charges = calculateAccommodationCharges(
    ratePerNight * nights,
    (hotel.settings ?? {}) as Record<string, unknown>,
  );
  const totalAmount = charges.totalAmount;
  const discountAmount = baseRateResult
    ? Math.max(0, baseRateResult.suggestedRate - ratePerNight) * nights
    : 0;

  // Single transaction: re-verify availability + guest upsert + reservation + audit + notify
  const reservation = await wt(async (db) => {
    // 1. Re-verify availability inline (atomic with reservation creation)
    const allRooms = await db.room.findMany({
      where:  { roomTypeId: dto.roomTypeId, isActive: true, status: { notIn: ["OUT_OF_ORDER", "BLOCKED"] } },
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
    const blockedRoomIds = await db.roomInventoryBlock.findMany({
      where: { roomId: { in: allRooms.map((r) => r.id) }, cancelledAt: null, startDate: { lt: new Date(dto.checkOutDate) }, endDate: { gt: new Date(dto.checkInDate) } },
      select: { roomId: true },
    });
    const bookedSet  = new Set([...bookedRoomIds, ...blockedRoomIds].map((r) => r.roomId));
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

    await applyPublicGuestCrm(db, hotel.id, guest.id, dto);

    if (rateResult.appliedCode) {
      await assertPromoCodeGuest(db, hotel.id, rateResult.appliedCode, guest.id);
      const consumed = await consumePromoCode(db, hotel.id, rateResult.appliedCode);
      if (!consumed) {
        throw new AppError(409, "This offer was just used or is no longer available. Please recalculate your booking.");
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
        bookingContactEmail: dto.guestEmail ?? null,
        checkInDate:     new Date(dto.checkInDate),
        checkOutDate:    new Date(dto.checkOutDate),
        adults:          dto.adults,
        children:        dto.children,
        specialRequests: dto.specialRequests ?? null,
        quotedRate:      ratePerNight,
        subtotalAmount:  charges.subtotalAmount,
        taxAmount:       charges.taxAmount,
        taxInclusive:    charges.taxInclusive,
        taxBreakdown:    charges.taxBreakdown as unknown as Prisma.InputJsonValue,
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

  if (dto.guestEmail) {
    try {
      await enqueueReservationEmail("REQUEST_RECEIVED", [reservation.id], hotel.id);
    } catch (err) {
      console.error("Failed to enqueue booking request email:", err);
    }
  }

  // A direct booking races OTA inventory for the same rooms — republish before
  // a channel resells what this guest just took.
  queueChannexSync({
    hotelId:  hotel.id,
    reason:   "BOOKING_ENGINE",
    dateFrom: dto.checkInDate,
    dateTo:   dto.checkOutDate,
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
        where:  { roomTypeId: item.roomTypeId, isActive: true, status: { notIn: ["OUT_OF_ORDER", "BLOCKED"] } },
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
      const blockedIds = await db.roomInventoryBlock.findMany({
        where: { roomId: { in: allRooms.map((r) => r.id) }, cancelledAt: null, startDate: { lt: new Date(dto.checkOutDate) }, endDate: { gt: new Date(dto.checkInDate) } },
        select: { roomId: true },
      });
      const bookedSet   = new Set([...bookedIds, ...blockedIds].map((r) => r.roomId));
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

    await applyPublicGuestCrm(db, hotel.id, guest.id, dto);

    const appliedCode = [...rateMap.values()].find((rate) => rate.appliedCode)?.appliedCode;
    if (appliedCode) {
      await assertPromoCodeGuest(db, hotel.id, appliedCode, guest.id);
      const consumed = await consumePromoCode(db, hotel.id, appliedCode);
      if (!consumed) {
        throw new AppError(409, "This offer was just used or is no longer available. Please recalculate your booking.");
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
        where:  { roomTypeId: item.roomTypeId, isActive: true, status: { notIn: ["OUT_OF_ORDER", "BLOCKED"] } },
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
      const blockedIds = await db.roomInventoryBlock.findMany({
        where: { roomId: { in: allRooms.map((r) => r.id) }, cancelledAt: null, startDate: { lt: new Date(dto.checkOutDate) }, endDate: { gt: new Date(dto.checkInDate) } },
        select: { roomId: true },
      });
      const bookedSet = new Set([...bookedIds, ...blockedIds].map((r) => r.roomId));
      const freeRooms = allRooms.filter((r) => !bookedSet.has(r.id));
      const rateInfo = rateMap.get(item.roomTypeId);
      const ratePerNight = rateInfo?.ratePerNight ?? 0;
      const charges = calculateAccommodationCharges(
        ratePerNight * nights,
        (hotel.settings ?? {}) as Record<string, unknown>,
      );
      const totalAmount = charges.totalAmount;
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
            bookingContactEmail: dto.guestEmail ?? null,
            checkInDate:     new Date(dto.checkInDate),
            checkOutDate:    new Date(dto.checkOutDate),
            adults:          guestAllocation.adults,
            children:        guestAllocation.children,
            specialRequests: dto.specialRequests ?? null,
            quotedRate:      ratePerNight,
            subtotalAmount:  charges.subtotalAmount,
            taxAmount:       charges.taxAmount,
            taxInclusive:    charges.taxInclusive,
            taxBreakdown:    charges.taxBreakdown as unknown as Prisma.InputJsonValue,
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

    // 4b. Attach selected upsells. These are stay-level extras chosen once for
    // the whole cart, so they hang off the first reservation rather than being
    // duplicated per room. Prices are snapshotted here and only become folio
    // charges at check-in, since a reservation has no folio until then.
    if (dto.upsells?.length) {
      const anchorReservation = createdReservations[0];
      if (!anchorReservation) throw new AppError(500, "No reservation created for upsells.");

      const catalog = await db.upsellItem.findMany({
        where: { id: { in: dto.upsells.map((u) => u.upsellItemId) }, isActive: true },
      });

      const totalGuests = dto.adults + (dto.children ?? 0);
      for (const selection of dto.upsells) {
        const catalogItem = catalog.find((c) => c.id === selection.upsellItemId);
        if (!catalogItem) {
          throw new AppError(409, "One of the selected extras is no longer available.");
        }
        const multiplier =
          catalogItem.priceType === "PER_NIGHT" ? nights
          : catalogItem.priceType === "PER_GUEST" ? totalGuests
          : 1;

        await db.reservationUpsell.create({
          data: {
            reservationId: anchorReservation.id,
            upsellItemId:  catalogItem.id,
            name:          catalogItem.name,
            category:      catalogItem.category,
            quantity:      selection.quantity,
            unitAmount:    catalogItem.amount,
            amount:        catalogItem.amount * selection.quantity * multiplier,
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

  if (dto.guestEmail) {
    try {
      await enqueueReservationEmail(
        "REQUEST_RECEIVED",
        result.createdReservations.map((reservation) => reservation.id),
        hotel.id,
      );
    } catch (err) {
      console.error("Failed to enqueue multi-room booking request email:", err);
    }
  }

  // Same race as the single-room path, across more rooms at once.
  queueChannexSync({
    hotelId:  hotel.id,
    reason:   "BOOKING_ENGINE",
    dateFrom: dto.checkInDate,
    dateTo:   dto.checkOutDate,
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
