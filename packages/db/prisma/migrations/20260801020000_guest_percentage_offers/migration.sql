-- Guest CRM offers are percentage discounts on the best available public rate.
-- Existing rate-plan access codes keep their linked fixed-rate behaviour.

CREATE TYPE "PromoEmailStatus" AS ENUM ('NOT_REQUESTED', 'QUEUED', 'SENT', 'FAILED');

ALTER TABLE "rate_plan_codes"
  ALTER COLUMN "rate_plan_id" DROP NOT NULL,
  ADD COLUMN "discount_percent" INTEGER,
  ADD COLUMN "email_status" "PromoEmailStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
  ADD COLUMN "email_sent_at" TIMESTAMP(3),
  ADD COLUMN "email_error" TEXT;

ALTER TABLE "rate_plan_codes"
  ADD CONSTRAINT "rate_plan_codes_offer_shape_check" CHECK (
    ("discount_percent" IS NULL AND "rate_plan_id" IS NOT NULL)
    OR
    ("discount_percent" BETWEEN 1 AND 90 AND "guest_id" IS NOT NULL)
  );
