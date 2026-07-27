import assert from "node:assert/strict";
import test from "node:test";
import { reservationLifecycleEmail, type ReservationEmailData } from "./emailTemplates";

const baseData: ReservationEmailData = {
  kind: "REQUEST_RECEIVED",
  guestName: "Aisha & Hamza",
  hotelName: "North <Star> Lodge",
  hotelLogoUrl: "https://cdn.example.com/logo.png",
  hotelAddress: "Main Bazaar",
  hotelCity: "Hunza",
  hotelPhone: "+92 300 1234567",
  hotelWhatsapp: "+92 300 1234567",
  hotelEmail: "stay@example.com",
  hotelWebsite: "https://example.com",
  hotelAmenities: ["WiFi", "Mountain view"],
  accentColor: "#176B66",
  confirmationNumber: "GRP-2026-0012",
  checkInDate: "Fri, 24 Jul 2026",
  checkOutDate: "Sun, 26 Jul 2026",
  nights: 2,
  rooms: [
    {
      name: "Deluxe Room",
      description: "Balcony & valley view",
      quantity: 2,
      amount: 32000,
      photoUrls: [
        "https://cdn.example.com/deluxe-1.jpg",
        "https://cdn.example.com/deluxe-2.jpg",
      ],
      amenities: ["Balcony", "Heating"],
    },
    {
      name: "Family Suite",
      description: null,
      quantity: 1,
      amount: 24000,
      photoUrls: ["https://cdn.example.com/family.jpg"],
      amenities: ["Breakfast"],
    },
  ],
  adults: 5,
  children: 2,
  totalAmount: 56000,
  specialRequests: "<script>alert('x')</script>",
  promoCode: "FAMILY10",
  cancellationPolicy: "Free cancellation up to 72 hours before arrival.",
  bookingPaymentTerms: "The hotel will contact you about the deposit.",
};

test("request email uses accurate enquiry language and renders grouped rooms", () => {
  const html = reservationLifecycleEmail(baseData);
  assert.match(html, /Booking request received/);
  assert.match(html, /Awaiting hotel confirmation/);
  assert.match(html, /2 × Deluxe Room/);
  assert.match(html, /Family Suite/);
  assert.match(html, /3 rooms · 2 nights/);
  assert.match(html, /Main Bazaar, Hunza/);
  assert.match(html, /Get directions/);
  assert.match(html, /google\.com\/maps\/dir\/\?api=1&amp;destination=/);
  assert.doesNotMatch(html, /Your reservation is confirmed/);
});

test("customer and hotel content is HTML escaped", () => {
  const html = reservationLifecycleEmail(baseData);
  assert.match(html, /North &lt;Star&gt; Lodge/);
  assert.match(html, /Aisha &amp; Hamza/);
  assert.match(html, /&lt;script&gt;alert\(&#039;x&#039;\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>alert/);
});

test("cancellation email is a focused acknowledgement with hotel support details", () => {
  const html = reservationLifecycleEmail({ ...baseData, kind: "CANCELLED" });
  assert.match(html, /Reservation cancelled/);
  assert.match(html, /has been cancelled/);
  assert.match(html, /Cancellation reference/);
  assert.match(html, /\+92 300 1234567/);
  assert.match(html, /Free cancellation up to 72 hours before arrival/);
  assert.doesNotMatch(html, /Hotel location/);
  assert.doesNotMatch(html, /Get directions/);
  assert.doesNotMatch(html, /Check-in/);
  assert.doesNotMatch(html, /Check-out/);
  assert.doesNotMatch(html, /Original booking total/);
  assert.doesNotMatch(html, /cdn\.example\.com\/deluxe-1\.jpg/);
  assert.doesNotMatch(html, /Deluxe Room/);
  assert.doesNotMatch(html, /A few things to look forward to/);
  assert.doesNotMatch(html, /Booking &amp; payment terms/);
});

test("only public HTTPS images are rendered", () => {
  const html = reservationLifecycleEmail({
    ...baseData,
    hotelLogoUrl: "javascript:alert(1)",
    rooms: [{
      ...baseData.rooms[0],
      photoUrls: ["http://insecure.example.com/room.jpg", "https://cdn.example.com/safe.jpg"],
    }],
  });
  assert.doesNotMatch(html, /javascript:/);
  assert.doesNotMatch(html, /insecure\.example/);
  assert.match(html, /https:\/\/cdn\.example\.com\/safe\.jpg/);
});
