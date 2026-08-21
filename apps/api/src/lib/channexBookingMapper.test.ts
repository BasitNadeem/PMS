import assert from "node:assert/strict";
import test from "node:test";
import { parseBookingRevision, mapBookingSource, unwrapAttributes } from "./channexBookingMapper";

function bookingPayload(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      id: "rev-1",
      type: "booking_revision",
      attributes: {
        booking_id: "BK-123",
        revision_id: "rev-1",
        property_id: "prop-1",
        status: "new",
        ota_name: "BookingCom",
        ota_reservation_code: "OTA-999",
        arrival_date: "2026-09-01",
        departure_date: "2026-09-04",
        amount: "15000.00",
        customer: { name: "Ayesha", surname: "Khan", mail: "a@example.test", phone: "+923001234567" },
        rooms: [{
          room_type_id: "cx-rt-1",
          rate_plan_id: "cx-rp-1",
          checkin_date: "2026-09-01",
          checkout_date: "2026-09-04",
          amount: "15000.00",
          occupancy: { adults: 2, children: 1, infants: 0 },
        }],
        ...overrides,
      },
    },
  };
}

// ── Envelope handling ────────────────────────────────────────────────────────

test("unwraps the data/attributes envelope", () => {
  const attrs = unwrapAttributes(bookingPayload());
  assert.equal(attrs?.booking_id, "BK-123");
});

test("accepts a flat payload without the envelope", () => {
  const attrs = unwrapAttributes({ booking_id: "BK-9", property_id: "p" });
  assert.equal(attrs?.booking_id, "BK-9");
});

test("returns null for a non-object payload", () => {
  assert.equal(unwrapAttributes(null), null);
  assert.equal(unwrapAttributes("nope"), null);
});

// ── Happy path ───────────────────────────────────────────────────────────────

test("parses a new booking end to end", () => {
  const result = parseBookingRevision(bookingPayload());
  assert.equal(result.ok, true);
  if (!result.ok) return;

  const b = result.booking;
  assert.equal(b.bookingId, "BK-123");
  assert.equal(b.revisionId, "rev-1");
  assert.equal(b.propertyId, "prop-1");
  assert.equal(b.status, "NEW");
  assert.equal(b.guestName, "Ayesha Khan");
  assert.equal(b.guestEmail, "a@example.test");
  assert.equal(b.checkInDate, "2026-09-01");
  assert.equal(b.checkOutDate, "2026-09-04");
  assert.equal(b.rooms.length, 1);
  assert.equal(b.rooms[0].channexRoomTypeId, "cx-rt-1");
  assert.equal(b.rooms[0].adults, 2);
  assert.equal(b.rooms[0].children, 1);
});

test("money arrives as paisas via the shared utility, not as a float", () => {
  const result = parseBookingRevision(bookingPayload());
  assert.equal(result.ok, true);
  if (!result.ok) return;
  // "15000.00" major units -> 1,500,000 paisas. A naive parseFloat would give
  // 15000 and underprice the stay by 100x.
  assert.equal(result.booking.totalAmount, 1_500_000);
  assert.equal(result.booking.rooms[0].amount, 1_500_000);
});

test("a fractional amount keeps its paisas exactly", () => {
  const result = parseBookingRevision(bookingPayload({ amount: "1234.56" }));
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.booking.totalAmount, 123_456);
});

// ── Status normalisation ─────────────────────────────────────────────────────

test("recognises the three booking statuses across wordings", () => {
  for (const [raw, expected] of [
    ["new", "NEW"], ["booked", "NEW"], ["confirmed", "NEW"],
    ["modified", "MODIFIED"], ["modification", "MODIFIED"], ["amended", "MODIFIED"],
    ["cancelled", "CANCELLED"], ["canceled", "CANCELLED"], ["cancellation", "CANCELLED"],
  ] as const) {
    const result = parseBookingRevision(bookingPayload({ status: raw }));
    assert.equal(result.ok, true, `failed to parse status ${raw}`);
    if (result.ok) assert.equal(result.booking.status, expected, `wrong mapping for ${raw}`);
  }
});

test("an unrecognised status fails rather than guessing", () => {
  const result = parseBookingRevision(bookingPayload({ status: "quantum" }));
  assert.equal(result.ok, false);
});

// ── Channel mapping ──────────────────────────────────────────────────────────

test("maps known OTA names onto BookingSource", () => {
  assert.equal(mapBookingSource("BookingCom"), "BOOKING_COM");
  assert.equal(mapBookingSource("booking.com"), "BOOKING_COM");
  assert.equal(mapBookingSource("Booking_Com"), "BOOKING_COM");
  assert.equal(mapBookingSource("Agoda"), "AGODA");
  assert.equal(mapBookingSource("Expedia"), "EXPEDIA");
  assert.equal(mapBookingSource("Airbnb"), "AIRBNB");
});

test("an unknown channel falls back to OTA_OTHER without losing its name", () => {
  assert.equal(mapBookingSource("SomeNewOTA"), "OTA_OTHER");
  assert.equal(mapBookingSource(null), "OTA_OTHER");
  const result = parseBookingRevision(bookingPayload({ ota_name: "SomeNewOTA" }));
  assert.equal(result.ok, true);
  if (!result.ok) return;
  // The enum degrades, but ota_source preserves exactly what Channex said.
  assert.equal(result.booking.bookingSource, "OTA_OTHER");
  assert.equal(result.booking.otaName, "SomeNewOTA");
});

// ── Cancellations ────────────────────────────────────────────────────────────

test("a cancellation parses without rooms or dates", () => {
  // Cancellations are matched by ota_booking_ref, so they legitimately arrive
  // with nothing but an id and a status.
  const result = parseBookingRevision({
    booking_id: "BK-123", property_id: "prop-1", status: "cancelled",
  });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.booking.status, "CANCELLED");
});

test("a non-cancellation without rooms is rejected", () => {
  const result = parseBookingRevision(bookingPayload({ rooms: [] }));
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /no rooms/i);
});

// ── Defensive parsing ────────────────────────────────────────────────────────

test("rejects a payload with no booking id", () => {
  const result = parseBookingRevision({ property_id: "p", status: "new" });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /booking id/i);
});

test("rejects a payload with no property id", () => {
  const result = parseBookingRevision({ booking_id: "BK", status: "new" });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /property id/i);
});

test("rejects a stay whose checkout is not after checkin", () => {
  const result = parseBookingRevision(bookingPayload({
    arrival_date: "2026-09-04", departure_date: "2026-09-04",
  }));
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /not after/i);
});

test("falls back to room dates when the booking envelope omits them", () => {
  const payload = bookingPayload();
  delete (payload.data.attributes as Record<string, unknown>).arrival_date;
  delete (payload.data.attributes as Record<string, unknown>).departure_date;
  const result = parseBookingRevision(payload);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.booking.checkInDate, "2026-09-01");
  assert.equal(result.booking.checkOutDate, "2026-09-04");
});

test("a missing customer yields a placeholder rather than failing", () => {
  const payload = bookingPayload();
  delete (payload.data.attributes as Record<string, unknown>).customer;
  const result = parseBookingRevision(payload);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  // An OTA booking must never be dropped for want of a guest name.
  assert.equal(result.booking.guestName, "OTA Guest");
  assert.equal(result.booking.guestEmail, null);
});

test("occupancy defaults to one adult when absent", () => {
  const result = parseBookingRevision(bookingPayload({
    rooms: [{ room_type_id: "cx-rt-1", checkin_date: "2026-09-01", checkout_date: "2026-09-02" }],
  }));
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.booking.rooms[0].adults, 1);
  assert.equal(result.booking.rooms[0].children, 0);
});

test("an unparseable amount degrades to zero rather than throwing", () => {
  const result = parseBookingRevision(bookingPayload({ amount: "not-a-number" }));
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.booking.totalAmount, 0);
});

test("rooms missing required identifiers are skipped, not fatal", () => {
  const result = parseBookingRevision(bookingPayload({
    rooms: [
      { rate_plan_id: "no-room-type" },
      { room_type_id: "cx-rt-2", checkin_date: "2026-09-01", checkout_date: "2026-09-02", amount: "100.00" },
    ],
  }));
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.booking.rooms.length, 1);
  assert.equal(result.booking.rooms[0].channexRoomTypeId, "cx-rt-2");
});
