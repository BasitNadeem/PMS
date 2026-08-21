-- STEP 1 addendum — corrects the grain of the Channex rate plan mapping.
--
-- Channex models a rate plan as (property x room type). An InnFlo rate plan
-- spans N room types through rate_plan_items, so it needs N Channex rate plans.
-- A single id column on rate_plans could only ever record one of them, which
-- silently blocked every multi-room-type plan from distribution — 5 of 9 plans
-- in dev data, one of them otherwise fully eligible.
--
-- rate_plan_items IS (rate_plan x room_type): it already carries
-- UNIQUE(rate_plan_id, room_type_id), exactly the Channex grain.
--
-- Dropped rather than backfilled: verified zero non-null values in
-- rate_plans.channex_rate_plan_id before writing this (9 rows, 0 populated).
-- Nothing has been provisioned to Channex yet, so there is no mapping to lose.

-- AlterTable
ALTER TABLE "rate_plan_items"
    ADD COLUMN "channex_rate_plan_id" TEXT;

-- DropIndex
DROP INDEX "rate_plans_hotel_id_channex_rate_plan_id_idx";

-- AlterTable
ALTER TABLE "rate_plans"
    DROP COLUMN "channex_rate_plan_id";

-- CreateIndex
-- Serves both directions of the provisioning walk: "which items of this plan
-- still need a Channex rate plan" (IS NULL) and "which are already provisioned"
-- (IS NOT NULL), the latter being how the ARI worker filters what to push.
CREATE INDEX "rate_plan_items_rate_plan_id_channex_rate_plan_id_idx"
    ON "rate_plan_items"("rate_plan_id", "channex_rate_plan_id");
