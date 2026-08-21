-- Checked-in room moves and financial adjustments require immutable history.
-- The live assignment remains in reservation_rooms; this table records every
-- post-check-in change and the folio items created for customer visibility.
CREATE TABLE "reservation_stay_changes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "hotel_id" UUID NOT NULL,
  "reservation_id" UUID NOT NULL,
  "reservation_room_id" UUID NOT NULL,
  "change_type" TEXT NOT NULL,
  "effective_date" DATE NOT NULL,
  "from_room_id" UUID NOT NULL,
  "to_room_id" UUID NOT NULL,
  "from_room_number" TEXT NOT NULL,
  "to_room_number" TEXT NOT NULL,
  "from_room_type_name" TEXT NOT NULL,
  "to_room_type_name" TEXT NOT NULL,
  "previous_rate" INTEGER NOT NULL,
  "new_rate" INTEGER NOT NULL,
  "rate_adjustment" INTEGER NOT NULL DEFAULT 0,
  "rebate_amount" INTEGER NOT NULL DEFAULT 0,
  "internal_reason" TEXT NOT NULL,
  "customer_description" TEXT NOT NULL,
  "folio_item_ids" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  "created_by" UUID NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "reservation_stay_changes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "reservation_stay_changes_hotel_id_fkey"
    FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE,
  CONSTRAINT "reservation_stay_changes_reservation_id_fkey"
    FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE CASCADE
);

CREATE INDEX "reservation_stay_changes_hotel_id_created_at_idx"
  ON "reservation_stay_changes"("hotel_id", "created_at");
CREATE INDEX "reservation_stay_changes_reservation_id_created_at_idx"
  ON "reservation_stay_changes"("reservation_id", "created_at");
CREATE INDEX "reservation_stay_changes_reservation_room_id_idx"
  ON "reservation_stay_changes"("reservation_room_id");
