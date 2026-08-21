# Product Summary — InnFlo

## One-Sentence Description
InnFlo is an all-in-one operating system for independent hotels and small properties, replacing spreadsheets, paper registers, and disconnected tools with a single system for reservations, billing, housekeeping, dining, and reporting.

## Elevator Pitch
InnFlo gives a small hotel, guesthouse, or resort one place to run its entire operation — from the moment a guest books a room to the moment they check out and pay. Front-desk staff manage arrivals and bills, housekeeping staff know exactly which rooms need cleaning, the kitchen gets orders instantly, and the owner can see how the business is performing without chasing down a dozen different registers. It also connects the hotel's rooms to big booking sites like Booking.com and Expedia, so availability and prices stay in sync everywhere automatically.

## Problem It Solves
Independent hotels typically run on a patchwork of paper registers, WhatsApp groups, Excel sheets, and manual phone calls to keep online travel agency (OTA) listings updated. This causes double bookings, lost guest information, inconsistent pricing, and no real visibility into how the property is performing. InnFlo centralizes all of that into one connected system.

## Who It Is For
- Independent hotel owners and small hotel groups (INFERRED from `Hotel` model and subscription-plan structure)
- Guesthouses, hostels, resorts, lodges, campsites/glamping sites, and serviced apartments (INFERRED from the `RoomType`/property-type options and dedicated marketing pages for these stay types)
- Front-desk/reception staff, housekeeping staff, kitchen/restaurant staff, maintenance staff, and accountants working at these properties (INFERRED from distinct user roles)
- Properties primarily operating in Pakistan (INFERRED from built-in support for Pakistani tax regimes — GST, provincial sales taxes — FBR e-invoicing fields, and local payment methods like JazzCash/Easypaisa)
- Properties that sell rooms both directly and through OTAs such as Booking.com, Agoda, Expedia, Airbnb, and Pakistani platforms like BookMe.pk and SastaTicket.pk

## Main Customer Outcome
A hotel owner or manager gets one connected system to run daily operations, stops losing bookings to manual errors or channel mix-ups, and gains real visibility into occupancy, revenue, and staff performance — without needing separate software for each department.

## Major Product Areas
- **Front Desk & Reservations** — taking bookings, checking guests in and out, managing room status
- **Guest Billing (Folio)** — building up a guest's bill during their stay and settling payment
- **Guest Profiles (CRM)** — guest history, preferences, VIP status, birthdays/anniversaries
- **Corporate & Group Accounts** — billing companies and travel agents on account, and managing group bookings
- **Housekeeping** — tracking which rooms need cleaning and by whom, including a phone app for cleaning staff
- **Maintenance** — logging and tracking repair/maintenance issues
- **Restaurant / Point of Sale (POS)** — taking food & beverage orders, including QR-code table ordering, and charging them to a guest's room
- **Rates & Pricing** — setting room prices, seasonal rates, and promotional codes
- **Channel Manager** — keeping room availability and prices in sync with online travel agencies automatically
- **Direct Booking Engine** — a hotel's own branded website where guests can book directly, without a commission
- **Reporting & Analytics** — around two dozen business reports covering revenue, occupancy, guests, staff, and inventory
- **Inventory & Cash Management** — tracking stock/supplies and daily cash reconciliation
- **Staff & Shift Management** — shift handovers, staff activity, and role-based access

## Strongest Value Propositions
1. **One system instead of many** — reservations, billing, housekeeping, dining, and reporting live in one place instead of scattered across paper and apps.
2. **Commission-free direct bookings** — a hotel gets its own booking website so guests can book directly without paying a cut to an OTA.
3. **Automatic OTA sync** — room availability and rates update automatically across connected online travel agencies, reducing the risk of double-booking or overselling.
4. **Built for how small hotels actually work** — role-specific tools for front desk, housekeeping (including offline mobile use), kitchen, and maintenance staff.
5. **Real business visibility** — a broad set of built-in reports gives owners insight into revenue, occupancy, guest patterns, staff activity, and stock levels without manual spreadsheet work.
6. **Guest relationship memory** — the system remembers guest history, VIP status, and special dates like birthdays and anniversaries to support repeat business.
7. **Built with local business needs in mind** — supports Pakistani tax rules, local payment methods, and multiple property types (hotel, guesthouse, resort, glamping site, etc.).

## Major Workflows
- Taking a reservation (walk-in, phone, WhatsApp, OTA, or the hotel's own booking website) and confirming it
- Checking a guest in, assigning a room, and checking them out
- Building a guest's bill throughout their stay (room charges, food, laundry, and other extras) and collecting payment
- Assigning and tracking housekeeping cleaning tasks room by room
- Taking and fulfilling restaurant/room-service orders, including guest self-ordering via QR code
- Keeping a hotel's rates and availability synced automatically with OTAs
- Billing a corporate client or travel agency on account instead of per-guest
- Running daily/monthly reports to review how the business is performing

## Important Integrations
- **Channel Manager (Channex)** — automatically pushes a hotel's room availability and rates to OTAs (Booking.com, Agoda, Expedia, Airbnb, BookMe.pk, SastaTicket.pk) and pulls in bookings made on those platforms, keeping everything in sync without manual updates.
- **Transactional Email** — automatically emails guests booking confirmations, cancellations, and promo-code offers.

## Automation
- Automatic two-way sync between the hotel's inventory/rates and connected OTAs whenever a booking is made, cancelled, or rates change.
- Automatic booking confirmation and cancellation emails to guests.
- Automatic detection of guest birthdays/anniversaries to support personalized offers.
- Automatic creation of a housekeeping cleaning task when a guest checks out.
- Real-time updates across front-desk screens (e.g., new bookings appear instantly for staff).
- Daily "night audit" that automatically snapshots occupancy, revenue, and outstanding balances for the day.

## User Roles
- **Owner** — full control over the hotel's account and setup
- **Manager** — oversees day-to-day operations across departments
- **Front Desk** — manages reservations, check-in/out, guest billing
- **Housekeeping** — manages room cleaning status and tasks (has its own simplified phone app)
- **Kitchen** — manages restaurant/POS orders
- **Maintenance** — manages repair and maintenance tickets
- **Accountant** — focused access to financial reports and records

## Potential Differentiators
- Combining a **channel manager**, a **commission-free direct booking site**, and **full back-office operations** (housekeeping, POS, inventory) in one connected product, rather than requiring separate tools stitched together.
- Purpose-built support for a **wide range of property types** beyond standard hotels — guesthouses, hostels, resorts, glamping/tented camps, and serviced apartments.
- Localized for the **Pakistani hospitality market** — local tax handling, local payment methods, and regional OTA coverage (BookMe.pk, SastaTicket.pk) alongside global OTAs.
(These are supported by the implementation but should not be marketed as "market-first" or "unique" claims without founder confirmation — see MARKETING_FACTS.md.)

## Current Limitations / Uncertainties
- **WhatsApp messaging is not yet live.** WhatsApp appears throughout the product as a booking source and communication channel, but the actual message-sending integration is currently a placeholder that does not send real messages. **NEEDS FOUNDER INPUT** on timeline before this can be marketed as a feature.
- **No online payment collection during booking.** Guests can request/confirm a booking through the direct booking website, but payment (deposit or full amount) is not collected online — it is settled manually at the property using recorded payment methods (cash, card, bank transfer, JazzCash, Easypaisa, etc.). This should not be marketed as "pay online" or "secure checkout."
- **Rate plan discount/markup modifiers do not currently work as configured** — this is a known internal issue and should not be referenced in marketing.
- **Minimum-stay rate plans are not distributed to OTAs** — a known distribution limitation.
- **Negotiated per-company contract rates** (e.g., special pricing for a specific travel agency) are not yet built — only a basic default discount can be applied to a corporate account.
- **Fine-grained staff permissions** (customizable per-role access) are not yet live; today, access is controlled by a fixed set of roles.
- **Pakistan FBR e-invoicing** (government e-invoice submission) has data fields prepared but the actual submission integration status is unclear. **NEEDS FOUNDER INPUT.**
- **SMS messaging** is modeled in the system but not connected to an actual SMS provider.
