# User Journeys

The most important end-to-end workflows a customer accomplishes with InnFlo.

---

# Journey: Guest Books Directly on the Hotel's Own Website

Persona: A traveler searching for a place to stay; the hotel avoids paying OTA commission.

Starting situation: A guest wants to book a room directly rather than through Booking.com or a similar site.

Steps:
1. Guest visits the hotel's own booking website (its own web address/subdomain).
2. Guest selects check-in/check-out dates and number of guests.
3. Guest browses available room types with photos, amenities, and prices; optionally applies a promo code.
4. Guest adds optional extras (e.g., breakfast, airport transfer, late checkout).
5. Guest enters their details and submits the booking.
6. Guest receives a confirmation.

System behavior: The system checks live availability and rate plans, applies any valid promo code, calculates the total including extras, creates the reservation, sends a confirmation email, and automatically updates availability across every connected OTA so the room can't be double-booked elsewhere.

Final outcome: The hotel gains a direct, commission-free booking, and the guest has a simple self-service booking experience.

Why it matters: Every booking made this way is pure margin for the hotel compared to an OTA booking, which typically carries a 15-20%+ commission.

Best demo moment: The moment a guest adds a room to their cart and sees the live price update with extras — visually clean and easy for a non-technical audience to follow.

Implementation confidence: HIGH (core booking flow); payment collection is not part of this flow (see caveats in FEATURES.md).

Evidence: `apps/web/src/pages/booking-engine/BookingLandingPage.tsx`, `BookingFormPage.tsx`, `apps/api/src/routes/bookingPublic.ts`.

---

# Journey: Front Desk Handles a Walk-In Guest, Check-In to Check-Out

Persona: Front desk staff member at a small hotel.

Starting situation: A guest arrives without a prior reservation and wants a room for the night.

Steps:
1. Staff checks room availability on the reservations/rooms screen.
2. Staff creates a new reservation for the walk-in guest, selecting a room type and rate.
3. Staff checks the guest in and assigns a specific room.
4. During the stay, any extra charges (restaurant orders, laundry, etc.) are added to the guest's folio.
5. At checkout, staff reviews the total bill and records payment.
6. The room is automatically flagged for cleaning.

System behavior: The system creates the guest's profile (or matches an existing one), builds the bill in real time as charges are added, and automatically creates a housekeeping task the moment the guest checks out.

Final outcome: A guest is served from arrival to departure using one connected system, with an accurate final bill and no manual reconciliation.

Why it matters: This is the daily bread-and-butter operation of any hotel — showing it works smoothly is core to proving the product's value.

Best demo moment: Checkout — showing the itemized bill built automatically from multiple charges, then the instant housekeeping task appearing.

Implementation confidence: HIGH

Evidence: `apps/web/src/pages/reservations/`, `apps/web/src/pages/folio/`, `apps/api/src/services/ReservationService.ts`, `apps/api/src/services/FolioService.ts`.

---

# Journey: A Room Gets Booked on Booking.com and Automatically Syncs

Persona: Hotel owner/manager who lists rooms on multiple OTAs.

Starting situation: A hotel has connected its room inventory to Booking.com, Agoda, and other OTAs through InnFlo's channel manager.

Steps:
1. A traveler books a room on Booking.com.
2. Booking.com notifies InnFlo of the new booking automatically.
3. The booking appears in InnFlo's reservation list, tagged with its OTA source.
4. InnFlo automatically reduces the available inventory for that room type/date and pushes the updated availability back out to all other connected OTAs.

System behavior: A background sync process ingests the OTA booking, creates the reservation, and immediately recalculates and republishes availability everywhere else, preventing the same room from being sold twice.

Final outcome: The hotel never has to manually check or update multiple OTA extranets — everything reconciles automatically.

Why it matters: Overbooking from unsynced OTA calendars is one of the most damaging and common problems for independent hotels; this directly prevents it.

Best demo moment: Showing a booking appear on the OTA side and then, moments later, appearing automatically inside InnFlo's reservation list with availability already adjusted.

Implementation confidence: HIGH

Evidence: `apps/api/src/routes/webhooksChannex.ts`, `apps/api/src/jobs/channexBookingWorker.ts`, `apps/api/src/jobs/channexSyncWorker.ts`.

---

# Journey: Housekeeping Cleans a Room Using the Mobile App

Persona: Housekeeping staff member using their own phone.

Starting situation: A guest has just checked out and the room needs cleaning before it can be sold again.

Steps:
1. A cleaning task is automatically created when the guest checks out.
2. The housekeeping staff member opens InnFlo's mobile housekeeping app on their phone.
3. They see their assigned rooms/tasks, including while offline (e.g., in a basement or area with poor signal).
4. They mark the room clean once finished.
5. The update syncs back the moment the phone reconnects.

System behavior: The room's status updates in real time for front desk once synced, making the room immediately available to sell/assign again.

Final outcome: Rooms get back into circulation faster, and front desk always knows what's truly ready.

Why it matters: This demonstrates the product working for frontline staff, not just management — and that it's built for real-world conditions (spotty Wi-Fi).

Best demo moment: Marking a room clean on a phone and then instantly switching to the front-desk screen to show the room status change live.

Implementation confidence: HIGH

Evidence: `apps/web/src/pages/housekeeping/HousekeepingMobilePage`, `apps/api/src/services/HousekeepingService.ts`.

---

# Journey: Guest Orders Food by Scanning a QR Code

Persona: A hotel guest at the in-house restaurant or in their room.

Starting situation: A guest wants to order food without waiting to flag down staff.

Steps:
1. Guest scans a QR code at their table (or in their room).
2. The digital menu opens on their phone — no app download or login required.
3. Guest browses items and places an order.
4. The order appears instantly on the kitchen's display screen.
5. Kitchen staff prepare and mark the order fulfilled.
6. The charge is posted to the guest's room bill (or collected directly, depending on setup).

System behavior: The order routes automatically to the kitchen display and, when charged to the room, appears on the guest's folio without any manual re-entry by staff.

Final outcome: Faster, more modern guest service with fewer order-taking errors.

Why it matters: A highly visual, easy-to-demo feature that shows off the product's modern, guest-facing side — great for social media content.

Best demo moment: Scanning the QR code and watching the order appear live on the kitchen display seconds later.

Implementation confidence: HIGH

Evidence: `apps/web/src/pages/menu/GuestMenuPage`, `apps/web/src/pages/kitchen/`, `apps/api/src/services/QrOrderService.ts`.

---

# Journey: Manager Reviews Daily Business Performance

Persona: Hotel owner or manager checking on the business.

Starting situation: A manager wants to know how the property performed today or this month — occupancy, revenue, and any issues.

Steps:
1. Manager opens the dashboard for a quick overview.
2. Manager opens specific reports (daily report, occupancy trend, revenue by source, outstanding balances, etc.) for more detail.
3. Manager reviews numbers and takes action (e.g., adjusts pricing, follows up on outstanding balances).

System behavior: Reports pull together data already captured through daily operations (reservations, folios, POS, housekeeping) — no separate manual reporting effort required.

Final outcome: The manager has clear, current visibility into the business without needing to build spreadsheets.

Why it matters: This is where InnFlo proves ongoing value beyond day-to-day operations — it turns daily activity into business intelligence.

Best demo moment: Scrolling through a visually rich report (e.g., occupancy trend or revenue-by-source chart) that clearly reflects real activity captured elsewhere in the demo.

Implementation confidence: HIGH

Evidence: `apps/web/src/pages/reports/`, `apps/api/src/services/ReportService.ts`.

---

# Journey: Hotel Bills a Corporate Travel Agency on Account

Persona: Accountant or manager at a hotel that regularly hosts guests sent by a travel agency or company.

Starting situation: A travel agency regularly books rooms for its clients and wants to be invoiced periodically rather than paying per booking.

Steps:
1. Manager sets up a company account for the travel agency, with agreed payment terms and a credit limit.
2. Bookings made for that agency's clients are linked to the company account.
3. Charges accumulate on the company's ledger instead of being billed to each individual guest.
4. At the end of the billing period, the hotel generates a consolidated invoice for the company.
5. Payment is recorded against the company's ledger.

System behavior: All charges tied to the company automatically roll up into one running balance, and a formal invoice can be generated covering the period.

Final outcome: The hotel maintains a clean, professional billing relationship with its recurring business clients.

Why it matters: Relevant for hotels that rely on corporate or agency business, a meaningfully different sales motion from individual leisure guests.

Best demo moment: Showing the company ledger with multiple stays rolled into one clean invoice.

Implementation confidence: MEDIUM — core ledger/invoicing works, but negotiated custom pricing per company is not yet built (see FEATURES.md caveats).

Evidence: `apps/web/src/pages/companies/`, `apps/api/src/services/CompanyService.ts`.

---

# Journey: A Guest's Birthday Triggers a Personalized Offer

Persona: Returning guest with a profile on file; hotel marketing/front-desk team.

Starting situation: A guest who has stayed before has a birthday coming up.

Steps:
1. The system automatically identifies upcoming guest birthdays/anniversaries from stored guest profiles.
2. A personalized promo code or greeting can be issued tied to that guest and occasion.
3. The guest receives the offer.

System behavior: A daily automated sweep checks for upcoming special dates and can trigger promo code issuance for eligible guests.

Final outcome: The hotel can re-engage past guests with a personal touch, supporting repeat bookings.

Why it matters: A good example of how the product's guest-memory data translates into a tangible marketing action, not just record-keeping.

Best demo moment: Showing a guest profile with an upcoming birthday flagged, and the resulting promo code.

Implementation confidence: MEDIUM — birthday detection and promo code issuance work; the actual guest-facing message delivery mechanism (e.g., WhatsApp) should not be shown as functioning, since WhatsApp sending is currently a placeholder (email delivery is functional).

Evidence: `apps/api/src/services/GuestOccasionService.ts`, `apps/api/src/jobs/occasionWorker.ts`, `RatePlanCode`/`PromoIssueReason` model.

---

# Journey: Shift Handover Between Front Desk Staff

Persona: Outgoing and incoming front-desk staff at a shift change.

Starting situation: One front-desk shift is ending and another is beginning; cash and open tasks need to be handed over cleanly.

Steps:
1. Outgoing staff reconciles their cash drawer (opening vs. closing balance) within the system.
2. Any variance is recorded.
3. A handover briefing is prepared summarizing the shift (check-ins/outs, notes for the next shift).
4. Incoming staff reviews the handover before starting their shift.

System behavior: The system captures cash reconciliation numbers and compiles a shift summary automatically from the day's activity.

Final outcome: Clean accountability for cash handling and no information lost between shifts.

Why it matters: Reduces disputes over missing cash and keeps front-desk operations consistent across shifts, which matters a lot for 24-hour front desks.

Best demo moment: The shift handover summary screen showing reconciled cash and a clear briefing for the next team.

Implementation confidence: HIGH

Evidence: `apps/web/src/pages/shifts/ShiftHandoverPage`, `apps/api/src/services/ShiftService.ts`, `ShiftReport` model.

---

# Journey: New Hotel Owner Onboards to InnFlo

Persona: A hotel owner setting up InnFlo for their property for the first time.

Starting situation: The owner has just signed up and needs to configure their property before staff can use it.

Steps:
1. Owner logs in and is guided through an onboarding setup wizard.
2. Owner sets up basic property details, room types, and rates.
3. Owner invites staff and assigns roles.
4. Owner optionally connects OTAs via the channel manager and configures the direct booking website.

System behavior: The system tracks onboarding progress and gates full app access until key setup steps are completed.

Final outcome: The property is fully configured and ready to take bookings and manage day-to-day operations.

Why it matters: A smooth first-time setup experience is critical to a new customer actually adopting and sticking with the product.

Best demo moment: The onboarding wizard's guided, step-by-step feel — good for showing "how easy it is to get started."

Implementation confidence: HIGH

Evidence: `apps/web/src/pages/onboarding/OnboardingPage`, `Hotel.onboardingCompleted` field.
