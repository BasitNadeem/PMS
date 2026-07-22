-- Rate Plan access codes for public Booking Engine promo/corporate pricing.
-- Codes are independently activatable and expire separately from the Rate Plan's
-- stay-date rules. Existing plans remain public by default (code_required=false).

ALTER TABLE "rate_plans"
  ADD COLUMN "code_required" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "reservations"
  ADD COLUMN "applied_rate_plan_name" TEXT,
  ADD COLUMN "promo_code" TEXT;

CREATE TABLE "rate_plan_codes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "hotel_id" UUID NOT NULL,
  "rate_plan_id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "label" TEXT,
  "valid_from" DATE,
  "valid_to" DATE,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "rate_plan_codes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "rate_plan_codes_hotel_id_code_key"
  ON "rate_plan_codes"("hotel_id", "code");
CREATE INDEX "rate_plan_codes_hotel_id_is_active_idx"
  ON "rate_plan_codes"("hotel_id", "is_active");
CREATE INDEX "rate_plan_codes_rate_plan_id_idx"
  ON "rate_plan_codes"("rate_plan_id");

ALTER TABLE "rate_plan_codes"
  ADD CONSTRAINT "rate_plan_codes_hotel_id_fkey"
  FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rate_plan_codes"
  ADD CONSTRAINT "rate_plan_codes_rate_plan_id_fkey"
  FOREIGN KEY ("rate_plan_id") REFERENCES "rate_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
