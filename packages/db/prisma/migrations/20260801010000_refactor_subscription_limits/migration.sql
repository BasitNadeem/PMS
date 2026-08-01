-- Subscription quotas are kept in a typed JSON object so adding a future quota
-- does not require one schema column per capability. JSON null means unlimited.
ALTER TABLE "subscription_plans"
  ADD COLUMN IF NOT EXISTS "limits" JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE "subscription_plans"
SET "limits" = jsonb_build_object(
  'maxRooms', CASE WHEN "max_rooms" >= 999 THEN NULL ELSE "max_rooms" END,
  'maxUsers', CASE WHEN "max_users" >= 999 THEN NULL ELSE "max_users" END,
  'maxActiveRatePlans', NULL,
  'maxActivePromoCodes', NULL
) || "limits";

ALTER TABLE "hotels"
  ADD COLUMN IF NOT EXISTS "limit_overrides" JSONB;

UPDATE "hotels"
SET "limit_overrides" = jsonb_build_object('maxRooms', "room_limit_override")
WHERE "room_limit_override" IS NOT NULL
  AND "limit_overrides" IS NULL;

-- Keep lifecycle flags aligned with the assigned plan. Paid hotels must never
-- retain an expired Trial flag after an admin upgrades them.
UPDATE "hotels" AS h
SET "is_trial_account" = (sp."slug" = 'trial'),
    "trial_ends_at" = CASE
      WHEN sp."slug" = 'trial' THEN COALESCE(h."trial_ends_at", NOW() + INTERVAL '30 days')
      ELSE NULL
    END
FROM "subscription_plans" AS sp
WHERE h."subscription_plan_id" = sp."id";

ALTER TABLE "subscription_plans"
  DROP COLUMN IF EXISTS "max_rooms",
  DROP COLUMN IF EXISTS "max_users";

ALTER TABLE "hotels"
  DROP COLUMN IF EXISTS "room_limit_override";
