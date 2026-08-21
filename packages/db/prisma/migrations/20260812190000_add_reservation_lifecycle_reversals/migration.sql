-- Append-only evidence for correcting accidental check-ins and checkouts.
CREATE TABLE "reservation_lifecycle_reversals" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "hotel_id" UUID NOT NULL,
  "reservation_id" UUID NOT NULL,
  "action_reversed" TEXT NOT NULL,
  "previous_status" TEXT NOT NULL,
  "restored_status" TEXT NOT NULL,
  "original_action_at" TIMESTAMPTZ NOT NULL,
  "reason" TEXT NOT NULL,
  "affected_folio_item_ids" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  "affected_task_ids" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  "created_by" UUID NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reservation_lifecycle_reversals_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "reservation_lifecycle_reversals_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE,
  CONSTRAINT "reservation_lifecycle_reversals_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE CASCADE
);

CREATE INDEX "reservation_lifecycle_reversals_hotel_id_created_at_idx"
  ON "reservation_lifecycle_reversals"("hotel_id", "created_at");
CREATE INDEX "reservation_lifecycle_reversals_reservation_id_created_at_idx"
  ON "reservation_lifecycle_reversals"("reservation_id", "created_at");
