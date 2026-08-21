CREATE TABLE "booking_pace_snapshots" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "hotel_id" UUID NOT NULL,
  "observation_at" TIMESTAMPTZ NOT NULL,
  "horizon_days" INTEGER NOT NULL DEFAULT 90,
  "snapshot" JSONB NOT NULL,
  "captured_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "booking_pace_snapshots_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "booking_pace_snapshots_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "booking_pace_snapshots_hotel_id_observation_at_key"
  ON "booking_pace_snapshots"("hotel_id", "observation_at");
CREATE INDEX "booking_pace_snapshots_hotel_id_captured_at_idx"
  ON "booking_pace_snapshots"("hotel_id", "captured_at");

ALTER TABLE "booking_pace_snapshots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "booking_pace_snapshots" FORCE ROW LEVEL SECURITY;
CREATE POLICY "hotel_isolation" ON "booking_pace_snapshots"
  USING ("hotel_id" = current_setting('app.current_hotel_id', true)::uuid)
  WITH CHECK ("hotel_id" = current_setting('app.current_hotel_id', true)::uuid);
