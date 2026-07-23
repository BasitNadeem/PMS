import { adminPrisma } from "@pms/db";
import { emailQueue, type ReservationEmailKind, type ReservationEmailRoom } from "../jobs/queues";

const THEME_ACCENTS: Record<string, string> = {
  WARM_CLAY:    "#B85134",
  PINE_TEAL:    "#176B66",
  AZURE_SLATE:  "#326A8A",
  INDIGO_NIGHT: "#4F46A5",
};

function unique(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Builds a complete, immutable email payload after the reservation transaction
 * commits. Email delivery is deliberately secondary: failures are logged by the
 * caller and never roll back a booking or status change.
 */
export async function enqueueReservationEmail(
  kind: ReservationEmailKind,
  reservationIds: string[],
): Promise<boolean> {
  const ids = unique(reservationIds).sort();
  if (ids.length === 0) return false;

  const reservations = await adminPrisma.reservation.findMany({
    where: { id: { in: ids }, source: "BOOKING_ENGINE" },
    include: {
      guest: { select: { fullName: true, email: true } },
      group: { select: { id: true, groupRef: true } },
      hotel: {
        select: {
          name: true,
          slug: true,
          address: true,
          city: true,
          phone: true,
          whatsappNumber: true,
          email: true,
          website: true,
          amenities: true,
          cancellationPolicy: true,
          bookingPaymentTerms: true,
          settings: true,
        },
      },
      rooms: {
        include: {
          roomType: {
            select: {
              name: true,
              description: true,
              photoUrls: true,
              amenities: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const lifecycleReservations = kind === "REQUEST_RECEIVED"
    ? reservations
    : reservations.filter((reservation) => reservation.status === kind);
  const first = lifecycleReservations[0];
  const guestEmail = first?.bookingContactEmail ?? first?.guest.email;
  if (!first || !guestEmail) return false;

  // A group status action supplies every member ID. Guard against accidentally
  // combining unrelated hotels or guests in one customer email.
  const stay = lifecycleReservations.filter(
    (reservation) =>
      reservation.hotelId === first.hotelId &&
      reservation.guestId === first.guestId,
  );
  if (stay.length === 0) return false;

  const roomMap = new Map<string, ReservationEmailRoom>();
  for (const reservation of stay) {
    const amountPerRoom = reservation.rooms.length > 0
      ? reservation.totalAmount / 100 / reservation.rooms.length
      : 0;
    for (const reservationRoom of reservation.rooms) {
      const roomType = reservationRoom.roomType;
      const existing = roomMap.get(reservationRoom.roomTypeId);
      if (existing) {
        existing.quantity += 1;
        existing.amount += amountPerRoom;
      } else {
        roomMap.set(reservationRoom.roomTypeId, {
          name:        roomType.name,
          description: roomType.description,
          quantity:    1,
          amount:      amountPerRoom,
          photoUrls:   unique(roomType.photoUrls),
          amenities:   unique(roomType.amenities),
        });
      }
    }
  }

  const settings = (first.hotel.settings ?? {}) as Record<string, unknown>;
  const themeKey = typeof settings.themeKey === "string" ? settings.themeKey : "WARM_CLAY";
  const guestName = first.bookingContactName?.trim() || first.guest.fullName;
  const specialRequests = unique(stay.map((reservation) => reservation.specialRequests)).join("\n") || null;
  const promoCode = unique(stay.map((reservation) => reservation.promoCode)).join(", ") || null;
  const groupRef = first.group?.groupRef ?? null;
  const stableReference = groupRef ?? first.confirmationNumber;
  const jobScope = first.group?.id ?? ids.join("-");

  await emailQueue.add(
    kind.toLowerCase().replace(/_/g, "-"),
    {
      kind,
      guestEmail,
      guestName,
      hotelName:           first.hotel.name,
      hotelLogoUrl:        typeof settings.logoUrl === "string" ? settings.logoUrl : null,
      hotelAddress:        first.hotel.address,
      hotelCity:           first.hotel.city,
      hotelPhone:          first.hotel.phone,
      hotelWhatsapp:       first.hotel.whatsappNumber,
      hotelEmail:          first.hotel.email,
      hotelWebsite:        first.hotel.website,
      hotelAmenities:      unique(first.hotel.amenities),
      accentColor:         THEME_ACCENTS[themeKey] ?? THEME_ACCENTS.WARM_CLAY,
      confirmationNumber:  stableReference,
      checkInDate:         dateOnly(first.checkInDate),
      checkOutDate:        dateOnly(first.checkOutDate),
      nights:              Math.max(
        1,
        Math.ceil((first.checkOutDate.getTime() - first.checkInDate.getTime()) / 86_400_000),
      ),
      rooms:               [...roomMap.values()],
      adults:              stay.reduce((sum, reservation) => sum + reservation.adults, 0),
      children:            stay.reduce((sum, reservation) => sum + reservation.children, 0),
      totalAmount:         stay.reduce((sum, reservation) => sum + reservation.totalAmount, 0) / 100,
      specialRequests,
      promoCode,
      cancellationPolicy:  first.cancellationPolicySnapshot ?? first.hotel.cancellationPolicy,
      bookingPaymentTerms: first.bookingPaymentTermsSnapshot ?? first.hotel.bookingPaymentTerms,
    },
    {
      // Prevent a double-clicked status action or retried HTTP request from
      // sending the same lifecycle email twice.
      jobId: `reservation-email-${kind.toLowerCase()}-${jobScope}`,
    },
  );

  return true;
}
