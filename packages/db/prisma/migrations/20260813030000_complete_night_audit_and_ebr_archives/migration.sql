-- Preserve every Night Audit revision instead of deleting history when an
-- authorised manager corrects a mistaken business-day close.
ALTER TABLE "night_audit_records"
  ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "reversed_at" TIMESTAMPTZ,
  ADD COLUMN "reversed_by" UUID,
  ADD COLUMN "reversal_reason" TEXT;

DROP INDEX IF EXISTS "night_audit_records_hotelId_businessDate_key";
CREATE UNIQUE INDEX "night_audit_records_hotelId_businessDate_revision_key"
  ON "night_audit_records"("hotelId", "businessDate", "revision");
CREATE INDEX "night_audit_records_hotelId_reversed_at_idx"
  ON "night_audit_records"("hotelId", "reversed_at");

-- An Early Bird Report is an immutable rendering of one exact Night Audit
-- revision plus the operational outlook captured when management opened it.
CREATE TABLE "early_bird_report_archives" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "hotel_id" UUID NOT NULL,
  "night_audit_id" UUID NOT NULL,
  "report_date" DATE NOT NULL,
  "forecast_days" INTEGER NOT NULL DEFAULT 10,
  "snapshot" JSONB NOT NULL,
  "generated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "generated_by" UUID NOT NULL,
  CONSTRAINT "early_bird_report_archives_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "early_bird_report_archives_hotel_id_fkey"
    FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE,
  CONSTRAINT "early_bird_report_archives_night_audit_id_fkey"
    FOREIGN KEY ("night_audit_id") REFERENCES "night_audit_records"("id") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX "early_bird_report_archives_night_audit_id_key"
  ON "early_bird_report_archives"("night_audit_id");
CREATE INDEX "early_bird_report_archives_hotel_id_report_date_idx"
  ON "early_bird_report_archives"("hotel_id", "report_date");
CREATE INDEX "early_bird_report_archives_hotel_id_generated_at_idx"
  ON "early_bird_report_archives"("hotel_id", "generated_at");
