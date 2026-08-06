# InnFlo Product Backlog

This file records agreed product work that is intentionally deferred. Items
here are not promises that the feature already exists.

## Company rate agreements

**Status:** Deferred — revisit when company/corporate pricing is prioritised.

Allow each hotel tenant to maintain different negotiated pricing for each
company, tour agency, government department, or NGO.

The eventual design should support:

- fixed contracted rates or discounts from a public/base rate plan;
- room-type-specific pricing;
- seasonal validity ranges, expiry dates, and blackout dates;
- weekday/weekend variation where needed;
- meal plan, tax inclusion, cancellation, and payment terms;
- automatic agreement selection when a company is attached to a reservation;
- an immutable applied-rate snapshot on the reservation; and
- authorised overrides with an audit reason.

All agreements must remain tenant-scoped. A hotel's agreements and prices must
never be visible to or applied by another hotel.

## One-off organisation group bookings

**Status:** Implemented in the group-booking flow.

Group creation should not force staff to create a permanent Company record for
a one-time agency, corporate, government, or NGO booking. Offer two explicit
paths:

1. **Select a company on file** — enables company history, negotiated agreements,
   credit billing, company ledger, and invoicing.
2. **Use a one-off organisation** — captures payer name and contact only, leaves
   `companyId` null, and uses ordinary room/rate-plan pricing.

The one-off path must not allow company credit, company-ledger posting,
company-specific contracted rates, or company invoices. Staff can convert/link
the payer to a Company later if the relationship becomes recurring.
