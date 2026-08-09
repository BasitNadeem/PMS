-- A negotiated company contract is an ordinary rate plan with a company
-- owner. Keeping the relationship on rate_plans lets company contracts reuse
-- the existing date, weekday, minimum-stay and room-type pricing engine.
ALTER TABLE "rate_plans"
  ADD COLUMN "company_id" UUID;

ALTER TABLE "rate_plans"
  ADD CONSTRAINT "rate_plans_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "rate_plans_hotel_id_company_id_is_active_idx"
  ON "rate_plans"("hotel_id", "company_id", "is_active");
