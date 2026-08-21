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

## Rate plan modifiers are configured but never applied

**Status:** Bug — needs triage. Found while building the Channex ARI sync;
deliberately not fixed there, since it affects normal PMS pricing too.

`rate_plans.modifier_type` (default `"FIXED"`) and `rate_plans.modifier_value`
(default `0`) exist in the schema and have since `0001_init`. **No code anywhere
reads either column.** A repo-wide search for `modifierType`, `modifierValue`,
`modifier_type` and `modifier_value` across every `.ts`/`.tsx`/`.js` file returns
hits only in `schema.prisma` and `0001_init/migration.sql` — never in
application code.

Rate resolution in `RatePlanService.suggestRateCore` returns the winning plan's
`rate_plan_items.rate` verbatim:

```ts
const baseRate = bestPlan ? bestPlan.items[0].rate : roomType.defaultRate;
// ...
return { suggestedRate: baseRate, baseRate, /* ... */ };
```

**User-visible symptom:** if the rate plan UI lets a manager set a modifier
(e.g. "+10%" or "−500"), that adjustment is silently ignored. The guest is
quoted the unmodified `rate_plan_items.rate`. No error, no warning — the number
simply never changes. Any hotel relying on a modifier has been mispricing.

**Triage needs to decide which is true:**

1. Modifiers are a real intended feature → implement them in `suggestRateCore`,
   and audit existing rows for non-default values that have been silently
   inert (each is a stay quoted at the wrong price).
2. Modifiers were superseded by per-room-type `rate_plan_items.rate` → drop both
   columns and remove them from any UI that still collects them.

Check whether the rate plan form currently writes these columns before choosing:
if it does, option 1 is a live mispricing bug rather than dead schema.

Note: this does **not** affect Channex distribution. The ARI sync resolves rates
through the same `rate_plan_items.rate` path the PMS itself uses, so OTA prices
match what InnFlo quotes directly. Fixing modifiers would correct both at once.

## Minimum-stay rate plans cannot be sold on OTAs

**Status:** Known distribution gap — recorded during the Channex ARI build, not
a defect in it.

A rate plan with `min_los > 1` is excluded from channel distribution entirely.
`lib/channexRates.ts` resolves each date as a one-night stay, so a plan with a
minimum length of stay never applies and is published as `stop_sell`.

**User-visible symptom:** a hotel with, say, a two-night weekend minimum cannot
sell that rate on any OTA. The rate simply never appears. Nothing errors.

**Why it is not simply a bug:** publishing a minimum-stay rate as an
unconditional nightly price would let a guest book one night at it, which is
worse than not publishing it.

**The real fix:** Channex supports `min_stay_arrival` and `min_stay_through` per
rate plan per date in `/restrictions`, and `ChannexRestrictionValue` already
carries both fields. A minimum-stay plan can therefore be published *with its
restriction attached* rather than excluded — the OTA then enforces the minimum
itself. That needs the resolver to emit the restriction alongside the rate, and
a decision about how `min_los` maps onto arrival-vs-through semantics.

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
