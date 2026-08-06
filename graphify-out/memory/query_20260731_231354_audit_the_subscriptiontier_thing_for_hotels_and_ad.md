---
type: "query"
date: "2026-07-31T23:13:54.568129+00:00"
question: "Audit the subscriptionTier thing for hotels and admin, check bugs, and identify numerical plan limits"
contributor: "graphify"
outcome: "useful"
source_nodes: ["SubscriptionPlan", "getEffectiveLimits", "AdminService", "HotelDetailPage", "qrPublic"]
---

# Q: Audit the subscriptionTier thing for hotels and admin, check bugs, and identify numerical plan limits

## Answer

Expanded from original query via graph vocabulary: subscription, tier, plan, features, limits, quota, usage, hotel, admin, rooms, rate, pos. Audit found the data-driven SubscriptionPlan merge and room/user enforcement are present, but public QR ordering bypasses qrOrdering, reportsExport and housekeepingPWA are not enforced, trial expiry is display-only, inactive plans remain assignable, hotel override UI uses stale selected-plan defaults and cannot naturally remove an override, usage counts differ from quota semantics, quota creates are race-prone, and feature registries are duplicated. Recommended typed quantitative limits for active rate plans now, POS outlets and channel connections once those entities exist, with null for unlimited and per-hotel overrides.

## Outcome

- Signal: useful

## Source Nodes

- SubscriptionPlan
- getEffectiveLimits
- AdminService
- HotelDetailPage
- qrPublic