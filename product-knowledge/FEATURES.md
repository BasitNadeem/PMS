# Features

Customer-facing capabilities of InnFlo, grouped by area. Internal-only technical detail is kept out except where it affects what a customer can actually do.

---

# Reservations & Front Desk

Status: IMPLEMENTED

Who uses it: Front desk staff, managers, owners

What it does: Lets staff create, view, and manage bookings — walk-ins, phone bookings, WhatsApp inquiries, travel-agent bookings, and bookings from the hotel's own website or OTAs — from a single screen. Staff can check guests in, assign rooms, check guests out, mark no-shows, and cancel or waitlist bookings.

Problem it solves: Replaces paper registers and scattered notebooks that make it easy to lose track of who's arriving, who's staying, and which rooms are free.

Customer benefit: Front desk staff always have an accurate, up-to-date view of arrivals, departures, and room status, reducing double-bookings and confusion during busy check-in periods.

Typical usage: A reservation is created (from any source), the guest arrives and is checked in with a room assignment, charges accumulate during the stay, and the guest is checked out once the bill is settled.

Automation / Integration: New bookings from OTAs (via the Channel Manager) and the hotel's own booking website flow into the same reservation list automatically.

Marketing-safe description: InnFlo gives hotel staff one screen to manage every reservation, no matter where the booking came from.

Evidence: `apps/web/src/pages/reservations/`, `apps/api/src/routes/reservations.ts`, `apps/api/src/services/ReservationService.ts`, `Reservation`/`ReservationRoom` models in schema.

Caveats: Guests can currently be checked out without payment being fully settled — this is a known internal process gap, not a customer-facing feature.

---

# Guest Billing (Folio)

Status: IMPLEMENTED

Who uses it: Front desk staff, accountants

What it does: Builds up an itemized bill for each guest's stay — room charges, food & beverage, laundry, transport, spa, and other extras — and records payments against it (cash, card, bank transfer, JazzCash, Easypaisa, and more).

Problem it solves: Manually tallying a guest's charges from multiple paper slips is slow and error-prone, especially for longer stays with lots of add-on charges.

Customer benefit: An accurate, itemized bill is always ready at checkout, and a hotel can split a bill across multiple payers if needed.

Typical usage: Charges are added to a guest's folio throughout their stay (room rate, restaurant orders, etc.); at checkout, the front desk reviews the total and records payment.

Marketing-safe description: Every charge from a guest's stay is automatically gathered into one clear bill, ready at checkout.

Evidence: `apps/web/src/pages/folio/`, `apps/api/src/routes/folio.ts`, `apps/api/src/services/FolioService.ts`, `Folio`/`FolioItem`/`FolioSplit`/`Payment` models.

Caveats: Bill splitting has known rough edges in the current UI; there is no live online payment gateway — all payments are recorded manually by staff after being collected.

---

# Guest Profiles & CRM

Status: IMPLEMENTED

Who uses it: Front desk staff, managers

What it does: Keeps a running profile for every guest — contact details, stay history, total spend, VIP status, tags, notes, and important dates like birthdays and anniversaries. Also maintains a shared blacklist for guests flagged for no-shows or fraud.

Problem it solves: Independent hotels often have no memory of repeat guests, missing opportunities to recognize loyal customers or avoid repeat problem guests.

Customer benefit: Staff can recognize returning guests, personalize service, and identify VIPs at a glance; owners can identify their best customers.

Typical usage: A guest's profile builds up automatically as they book and stay; staff can add notes, tags, or VIP status manually.

Automation / Integration: The system automatically flags upcoming guest birthdays/anniversaries to support personalized offers.

Marketing-safe description: InnFlo remembers every guest's history so staff can recognize and take care of repeat visitors.

Evidence: `apps/web/src/pages/guests/`, `apps/api/src/services/GuestService.ts`, `apps/api/src/services/GuestOccasionService.ts`, `Guest`/`GuestBlacklist`/`GuestSpecialDate` models.

Caveats: None significant.

---

# Corporate Accounts & Group Bookings

Status: IMPLEMENTED (core) / PARTIAL (negotiated rates)

Who uses it: Managers, accountants, front desk

What it does: Lets a hotel bill companies, travel agencies, or organizations "on account" instead of per-guest, with a running ledger, credit limits, and periodic consolidated invoices. Also supports creating group bookings for multiple guests staying together, either tied to a company or as a one-off group.

Problem it solves: Hotels that work with corporate clients or tour operators need to track balances owed by an organization over time, not just individual guest folios.

Customer benefit: Simplifies billing relationships with repeat corporate/agency clients and makes group travel bookings easy to manage together.

Typical usage: A company account is set up with payment terms and a credit limit; bookings made for that company post charges to its ledger; periodic invoices are generated and payments recorded.

Marketing-safe description: InnFlo lets hotels manage corporate and travel-agency accounts with running balances and consolidated invoicing.

Evidence: `apps/web/src/pages/companies/`, `apps/web/src/pages/groups/`, `apps/api/src/services/CompanyService.ts`, `apps/api/src/services/GroupService.ts`, `Company`/`CompanyLedgerEntry`/`CompanyInvoice`/`GroupBooking` models.

Caveats: Negotiated, contract-specific pricing per company (special seasonal rates, blackout dates, meal plans) is not yet built — only a flat discount or a default rate plan can currently be linked to a company account.

---

# Housekeeping Management

Status: IMPLEMENTED

Who uses it: Housekeeping staff, managers

What it does: Tracks the cleaning status of every room (clean, dirty, occupied, out of order, under maintenance) and assigns cleaning tasks to staff. Includes a dedicated, simplified mobile app for housekeeping staff to update room status from their own phone, including while offline.

Problem it solves: Front desk staff often don't know which rooms are actually ready to sell, leading to guests being sent to unclean rooms or clean rooms sitting unsold.

Customer benefit: Front desk always has an accurate, real-time view of which rooms are ready, and housekeeping staff have a simple tool that works even with unreliable Wi-Fi.

Typical usage: A room is marked dirty after checkout (often automatically), a cleaning task is assigned, and housekeeping marks it clean once done — updating room availability immediately.

Automation / Integration: A checkout automatically creates the next cleaning task for that room. Offline updates on the mobile app sync automatically once a connection is available.

Marketing-safe description: Housekeeping staff can update room status from their own phone, even without a strong Wi-Fi signal, and the front desk sees it instantly.

Evidence: `apps/web/src/pages/housekeeping/`, `apps/web/src/pages/housekeeping/HousekeepingMobilePage`, `apps/api/src/services/HousekeepingService.ts`, `HousekeepingTask`/`Room` models.

Caveats: The mobile housekeeping app is a premium feature — not automatically included on every subscription plan.

---

# Maintenance Tracking

Status: PARTIAL

Who uses it: Maintenance staff, managers

What it does: Lets staff log and track maintenance issues (category, priority, cost, parts used) for rooms or property areas.

Problem it solves: Maintenance requests often get lost in verbal handoffs; this gives them a trackable record.

Customer benefit: Nothing falls through the cracks — issues are logged, assigned, and tracked to completion.

Marketing-safe description: Maintenance issues can be logged and tracked until resolved.

Evidence: `apps/web/src/pages/maintenance/`, `apps/api/src/services/MaintenanceService.ts`, `MaintenanceTicket` model (explicitly noted internally as an early-stage module).

Caveats: This module is newer/less mature than other areas of the product and should be described modestly rather than as a full maintenance-management suite.

---

# Restaurant / Point of Sale (POS) & QR Ordering

Status: IMPLEMENTED

Who uses it: Restaurant/kitchen staff, front desk, guests (QR ordering)

What it does: Manages a restaurant/bar menu and takes orders — dine-in, room-charge, or pay-now — with a live kitchen display for order fulfillment. Guests can scan a QR code at their table to view a menu and place orders themselves, without needing an app or account.

Problem it solves: Removes the need for handwritten order slips and lets guests self-order for faster service; ties food charges directly to a guest's room bill when appropriate.

Customer benefit: Faster order-to-kitchen flow, fewer mistakes, and food charges automatically show up on a guest's bill when charged to their room.

Typical usage: Staff (or a guest via QR code) place an order, it appears on the kitchen display for fulfillment, and the charge is posted to the guest's folio or collected directly.

Automation / Integration: Orders route automatically to a live kitchen screen (including a TV-friendly kitchen display).

Marketing-safe description: Guests can order food from their phone by scanning a QR code, and the order goes straight to the kitchen.

Evidence: `apps/web/src/pages/pos/`, `apps/web/src/pages/menu/GuestMenuPage`, `apps/web/src/pages/kitchen/`, `apps/web/src/pages/qr-orders/`, `apps/api/src/services/PosService.ts`, `apps/api/src/services/QrOrderService.ts`.

Caveats: There is a known gap where "pay now" QR orders (paid on delivery) are not always recorded in the cash ledger the way room-charge orders are — an internal accounting process issue, not something to promote.

---

# Rate Plans & Pricing

Status: PARTIAL

Who uses it: Managers, owners

What it does: Lets a hotel define different rate plans (standard, seasonal, promotional, corporate, travel-agent, OTA-specific) with date ranges, minimum/maximum length of stay, and promo/access codes — including single-use codes tied to a guest occasion like a birthday.

Problem it solves: Different guest segments and seasons typically call for different pricing; this centralizes rate management instead of tracking prices ad hoc.

Customer benefit: Flexible pricing strategy without needing to manually update prices everywhere.

Marketing-safe description: Hotels can set up seasonal, promotional, and audience-specific rate plans, including personalized promo codes.

Evidence: `apps/web/src/pages/rates/`, `apps/api/src/services/RatePlanService.ts`, `RatePlan`/`RatePlanItem`/`RatePlanCode` models.

Caveats: A known bug means percentage/fixed-amount rate adjustments configured on a rate plan are not currently applied to the final price — do not market "flexible rate adjustments" as fully working until this is fixed. Rate plans with a minimum-stay requirement also cannot currently be published to OTAs.

---

# Channel Manager (OTA Sync)

Status: IMPLEMENTED

Who uses it: Owners, managers (configuration); works automatically in the background

What it does: Connects a hotel's room types and rates to online travel agencies (Booking.com, Agoda, Expedia, Airbnb, and Pakistani platforms BookMe.pk and SastaTicket.pk), automatically pushing availability/rate updates out and pulling new or changed bookings in.

Problem it solves: Manually updating availability across multiple OTA extranets is slow and error-prone, and is a leading cause of overbooking for independent hotels.

Customer benefit: A hotel can list on multiple major booking sites without manually managing each one, and greatly reduces the risk of accidentally selling the same room twice.

Typical usage: Once connected, room types and rate plans are set up to sync; any change (a new booking, a cancelled stay, a rate change) automatically updates every connected OTA within moments. OTA bookings flow back into InnFlo's reservation list automatically.

Automation / Integration: Fully automated background sync; a safety-net process also periodically double-checks for any missed updates.

Marketing-safe description: InnFlo automatically keeps room availability and prices in sync across Booking.com, Agoda, Expedia, Airbnb, and other connected travel sites.

Evidence: `apps/web/src/pages/channel-manager/`, `apps/api/src/services/ChannexService.ts`, `apps/api/src/services/ChannexProvisioningService.ts`, `apps/api/src/jobs/channexSyncWorker.ts`, `apps/api/src/jobs/channexBookingWorker.ts`, `apps/api/src/routes/webhooksChannex.ts`.

Caveats: Rate plans with minimum-stay rules are excluded from OTA distribution (see Rate Plans caveat above).

---

# Direct Booking Engine (Hotel's Own Booking Website)

Status: IMPLEMENTED (booking requests) / PARTIAL (payment)

Who uses it: Guests booking directly; hotel staff configure it

What it does: Gives each hotel its own branded booking website (on its own web address) where guests can search dates, browse room types with photos and amenities, apply a promo code, add extras (like breakfast or airport transfer), and submit a booking — with no commission paid to a third party.

Problem it solves: Selling only through OTAs means paying commission on every booking; a direct booking site lets a hotel capture bookings commission-free.

Customer benefit: Lower cost per booking for the hotel, and a modern, self-service booking experience for the guest.

Typical usage: A guest visits the hotel's booking website, searches dates, picks a room and any extras, and submits their booking request/details.

Automation / Integration: A booking made here automatically updates availability across connected OTAs too, so there's no risk of double-selling a room.

Marketing-safe description: Every hotel gets its own commission-free booking website where guests can search, choose a room, and book directly.

Evidence: `apps/web/src/pages/booking-engine/BookingLandingPage.tsx`, `BookingFormPage.tsx`, `apps/api/src/routes/bookingPublic.ts`, `apps/web/src/pages/booking-engine-hub/`.

Caveats: The booking site does not currently process online payment — bookings are captured as a request/confirmation, with any deposit or balance collected manually by the property afterward. This should not be described as "book and pay online."

---

# Reporting & Analytics

Status: IMPLEMENTED

Who uses it: Owners, managers, accountants

What it does: Provides around 25 built-in reports covering daily/monthly performance, revenue by source, payment methods, outstanding balances, occupancy trends, average daily rate, room-type performance, length of stay, guest demographics and repeat guests, housekeeping and maintenance performance, staff activity, stock consumption and waste, and POS/QR sales.

Problem it solves: Independent hotels rarely have visibility into their own performance beyond a bank balance; this gives owners real operational and financial insight.

Customer benefit: Owners can make informed decisions on pricing, staffing, and operations backed by real data, without manual spreadsheet building.

Marketing-safe description: InnFlo includes over 25 built-in reports covering revenue, occupancy, guests, staff, and inventory.

Evidence: `apps/web/src/pages/reports/` (~25 report pages), `apps/api/src/routes/reports.ts`, `apps/api/src/services/ReportService.ts`.

Caveats: None significant; report accuracy depends on data being entered consistently by staff.

---

# Inventory & Cash Management

Status: PARTIAL

Who uses it: Managers, accountants

What it does: Tracks stock items (par levels, reorder points, purchases, consumption, waste) mainly feeding POS/kitchen cost tracking, and provides a cashbook for recording and reconciling daily cash movements, plus shift-level cash reconciliation for front-desk staff.

Problem it solves: Gives visibility into stock usage/waste and daily cash handling, which are common blind spots for small hotels.

Customer benefit: Less shrinkage/waste, and clearer accountability for cash handled during each shift.

Marketing-safe description: InnFlo tracks stock levels and daily cash reconciliation to give owners better control over spending and cash handling.

Evidence: `apps/web/src/pages/inventory/`, `apps/web/src/pages/cashbook/`, `apps/web/src/pages/shifts/`, `apps/api/src/services/InventoryService.ts`, `apps/api/src/services/CashBookService.ts`, `apps/api/src/services/ShiftService.ts`.

Caveats: Internally flagged as an earlier-stage module compared to reservations/billing; some cash-flow edge cases (like certain QR "pay on delivery" orders) are not always reflected in the ledger yet.

---

# Staff, Shifts & Roles

Status: IMPLEMENTED

Who uses it: Owners, managers, all staff

What it does: Manages staff accounts with role-based access (Owner, Manager, Front Desk, Housekeeping, Kitchen, Maintenance, Accountant), and supports shift handovers with cash reconciliation and briefing notes between outgoing and incoming staff.

Problem it solves: Ensures each staff member only sees and does what's relevant to their job, and that nothing gets lost between shift changes.

Customer benefit: Better accountability and smoother handoffs between shifts, especially for 24-hour front desks.

Marketing-safe description: Each staff member gets access suited to their role, with clean handovers between shifts.

Evidence: `apps/web/src/pages/team/`, `apps/web/src/pages/shifts/`, `apps/api/src/services/UserService.ts`, `apps/api/src/services/ShiftService.ts`, `UserRole` enum, `ShiftReport` model.

Caveats: Today, access is controlled by a fixed set of 7 roles rather than fully customizable per-permission access; a more granular permissions system is built into the data model but not yet the live enforcement mechanism.

---

# Guest Messaging (Unified Inbox)

Status: PARTIAL

Who uses it: Front desk staff, managers

What it does: Provides a unified conversation view intended to bring together guest messages from WhatsApp, email, SMS, and OTA messaging channels (like Booking.com and Airbnb's own messaging) in one place.

Problem it solves: Guest inquiries often arrive across many different channels, making them easy to miss.

Marketing-safe description: (Do not publish a specific claim yet — see caveat.)

Evidence: `Conversation`/`Message` models with a `MessageChannel` enum including WhatsApp, email, SMS, and OTA channels.

Caveats: WhatsApp sending is currently a placeholder and does not send real WhatsApp messages yet; SMS is not connected to a live provider. This feature should not be marketed as functional WhatsApp/SMS messaging until the underlying integrations are completed. **NEEDS FOUNDER INPUT.**

---

# Night Audit

Status: IMPLEMENTED

Who uses it: Managers, accountants (typically run once daily)

What it does: Runs a daily process that snapshots the day's occupancy, revenue, and outstanding balances, and flags no-shows.

Problem it solves: Gives an end-of-day closing record of business performance, similar to a traditional hotel "night audit."

Customer benefit: A reliable daily record of business performance for accounting and trend tracking.

Marketing-safe description: InnFlo runs an automatic daily audit that records occupancy, revenue, and outstanding balances.

Evidence: `apps/web/src/pages/nightaudit/`, `apps/api/src/services/NightAuditService.ts`, `NightAuditRecord` model.

Caveats: None significant.
