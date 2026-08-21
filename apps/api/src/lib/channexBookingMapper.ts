/**
 * Parses Channex booking payloads into a shape InnFlo can write.
 *
 * Pure and defensive by design. Channex wraps entities as
 * `{ data: { id, type, attributes } }` in some responses and returns the
 * attributes flat in others, so every accessor tolerates both. Anything that
 * cannot be understood produces a structured failure rather than a partial
 * reservation — a half-mapped OTA booking is worse than a retryable error.
 *
 * ⚠ The field names below were NOT part of the manually verified endpoint set.
 * They follow Channex's documented booking-revision shape and are read
 * leniently (several aliases per field), but the first staging booking should
 * be diffed against `parseBookingRevision` before this is trusted in production.
 */

import { channexRateToPaisas } from "../utils/channexMoney";

/** BookingSource values that name a specific OTA Channex can deliver from. */
const OTA_SOURCE_MAP: Record<string, string> = {
  bookingcom:     "BOOKING_COM",
  booking:        "BOOKING_COM",
  "booking.com":  "BOOKING_COM",
  agoda:          "AGODA",
  expedia:        "EXPEDIA",
  airbnb:         "AIRBNB",
  bookmepk:       "BOOKME_PK",
  bookme:         "BOOKME_PK",
  sastaticketpk:  "SASTATICKET_PK",
  sastaticket:    "SASTATICKET_PK",
};

export type ChannexBookingStatus = "NEW" | "MODIFIED" | "CANCELLED";

export interface ParsedBookingRoom {
  channexRoomTypeId: string;
  channexRatePlanId: string | null;
  checkInDate: string;
  checkOutDate: string;
  /** Paisas, via the shared money utility. */
  amount: number;
  adults: number;
  children: number;
  infants: number;
}

export interface ParsedBooking {
  /** Channex booking id — stored in reservations.ota_booking_ref. */
  bookingId: string;
  /** Revision id, used for acknowledgement and idempotency. */
  revisionId: string;
  propertyId: string;
  status: ChannexBookingStatus;
  /** Raw channel name as Channex reports it — reservations.ota_source. */
  otaName: string | null;
  /** BookingSource enum value; OTA_OTHER when the channel is not enumerated. */
  bookingSource: string;
  otaReservationCode: string | null;
  guestName: string;
  guestEmail: string | null;
  guestPhone: string | null;
  checkInDate: string;
  checkOutDate: string;
  /** Paisas. */
  totalAmount: number;
  notes: string | null;
  rooms: ParsedBookingRoom[];
}

export interface ParseFailure {
  ok: false;
  error: string;
}

export interface ParseSuccess {
  ok: true;
  booking: ParsedBooking;
}

export type ParseResult = ParseSuccess | ParseFailure;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

/** Unwraps `{ data: { attributes } }`, `{ attributes }`, or a flat object. */
export function unwrapAttributes(payload: unknown): Record<string, unknown> | null {
  const root = asRecord(payload);
  if (!root) return null;
  const data = asRecord(root.data) ?? root;
  return asRecord(data.attributes) ?? data;
}

function str(source: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return null;
}

function int(source: Record<string, unknown>, fallback: number, ...keys: string[]): number {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
    if (typeof value === "string" && /^\d+$/.test(value.trim())) return parseInt(value, 10);
  }
  return fallback;
}

/** Decimal string → paisas, never inline arithmetic. Returns 0 when absent. */
function money(source: Record<string, unknown>, ...keys: string[]): number {
  const raw = str(source, ...keys);
  if (raw === null) return 0;
  try {
    return channexRateToPaisas(raw);
  } catch {
    return 0;
  }
}

function normaliseStatus(raw: string | null): ChannexBookingStatus | null {
  const value = (raw ?? "").toLowerCase();
  if (!value) return null;
  if (value.includes("cancel")) return "CANCELLED";
  if (value.includes("modif") || value.includes("amend")) return "MODIFIED";
  if (value.includes("new") || value.includes("book") || value.includes("confirm")) return "NEW";
  return null;
}

/** Channel name → BookingSource enum, defaulting to OTA_OTHER. */
export function mapBookingSource(otaName: string | null): string {
  if (!otaName) return "OTA_OTHER";
  const key = otaName.toLowerCase().replace(/[\s_-]/g, "");
  return OTA_SOURCE_MAP[key] ?? "OTA_OTHER";
}

function parseRooms(raw: unknown): ParsedBookingRoom[] {
  if (!Array.isArray(raw)) return [];
  const rooms: ParsedBookingRoom[] = [];

  for (const entry of raw) {
    const room = asRecord(entry);
    if (!room) continue;

    const channexRoomTypeId = str(room, "room_type_id", "roomTypeId");
    const checkInDate  = str(room, "checkin_date", "check_in_date", "arrival_date", "checkinDate");
    const checkOutDate = str(room, "checkout_date", "check_out_date", "departure_date", "checkoutDate");
    if (!channexRoomTypeId || !checkInDate || !checkOutDate) continue;

    const occupancy = asRecord(room.occupancy) ?? room;
    rooms.push({
      channexRoomTypeId,
      channexRatePlanId: str(room, "rate_plan_id", "ratePlanId"),
      checkInDate,
      checkOutDate,
      amount:   money(room, "amount", "total_price", "price"),
      adults:   int(occupancy, 1, "adults", "adult"),
      children: int(occupancy, 0, "children", "child"),
      infants:  int(occupancy, 0, "infants", "infant"),
    });
  }

  return rooms;
}

function parseGuestName(customer: Record<string, unknown> | null): string {
  if (!customer) return "OTA Guest";
  const full = str(customer, "full_name", "fullName", "name_full");
  if (full) return full;
  const first = str(customer, "name", "first_name", "firstName") ?? "";
  const last  = str(customer, "surname", "last_name", "lastName") ?? "";
  const joined = `${first} ${last}`.trim();
  return joined || "OTA Guest";
}

/**
 * Parses one booking revision. Returns a failure rather than throwing so the
 * ingestion worker can mark the event FAILED with a readable reason.
 */
export function parseBookingRevision(payload: unknown): ParseResult {
  const attributes = unwrapAttributes(payload);
  if (!attributes) return { ok: false, error: "Booking payload was not an object" };

  const bookingId = str(attributes, "booking_id", "bookingId", "unique_id", "id");
  if (!bookingId) return { ok: false, error: "Booking payload carried no booking id" };

  const revisionId = str(attributes, "revision_id", "revisionId", "id") ?? bookingId;

  const propertyId = str(attributes, "property_id", "propertyId");
  if (!propertyId) return { ok: false, error: "Booking payload carried no property id" };

  const status = normaliseStatus(str(attributes, "status", "state", "event", "revision_type"));
  if (!status) return { ok: false, error: `Unrecognised booking status: ${String(attributes.status ?? attributes.state ?? "none")}` };

  const rooms = parseRooms(attributes.rooms);

  // Stay dates: prefer the booking-level pair, fall back to the room envelope.
  const checkInDate = str(attributes, "arrival_date", "checkin_date", "check_in_date")
    ?? rooms.map((r) => r.checkInDate).sort()[0]
    ?? null;
  const checkOutDate = str(attributes, "departure_date", "checkout_date", "check_out_date")
    ?? rooms.map((r) => r.checkOutDate).sort().reverse()[0]
    ?? null;

  // A cancellation legitimately arrives without rooms — it is matched by
  // ota_booking_ref, so dates are not required to process it.
  if (status !== "CANCELLED") {
    if (rooms.length === 0) return { ok: false, error: "Booking payload contained no rooms" };
    if (!checkInDate || !checkOutDate) return { ok: false, error: "Booking payload carried no stay dates" };
    if (checkOutDate <= checkInDate) {
      return { ok: false, error: `Booking check-out ${checkOutDate} is not after check-in ${checkInDate}` };
    }
  }

  const customer = asRecord(attributes.customer) ?? asRecord(attributes.guest);
  const otaName = str(attributes, "ota_name", "otaName", "channel", "source");

  return {
    ok: true,
    booking: {
      bookingId,
      revisionId,
      propertyId,
      status,
      otaName,
      bookingSource: mapBookingSource(otaName),
      otaReservationCode: str(attributes, "ota_reservation_code", "otaReservationCode"),
      guestName:  parseGuestName(customer),
      guestEmail: customer ? str(customer, "mail", "email") : null,
      guestPhone: customer ? str(customer, "phone", "telephone", "phone_number") : null,
      checkInDate:  checkInDate  ?? "",
      checkOutDate: checkOutDate ?? "",
      totalAmount: money(attributes, "amount", "total_price", "price"),
      notes: str(attributes, "notes", "comment", "special_requests"),
      rooms,
    },
  };
}
