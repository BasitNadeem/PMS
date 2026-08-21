CREATE TYPE "RoomInventoryBlockType" AS ENUM ('OUT_OF_ORDER', 'OUT_OF_SERVICE');

CREATE TABLE "room_inventory_blocks" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "hotel_id" UUID NOT NULL,
  "room_id" UUID NOT NULL,
  "type" "RoomInventoryBlockType" NOT NULL,
  "start_date" DATE NOT NULL,
  "end_date" DATE NOT NULL,
  "reason" TEXT NOT NULL,
  "notes" TEXT,
  "created_by" UUID NOT NULL,
  "cancelled_at" TIMESTAMP(3),
  "cancelled_by" UUID,
  "cancel_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "room_inventory_blocks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "room_inventory_blocks_valid_range_check" CHECK ("end_date" > "start_date")
);

ALTER TABLE "room_inventory_blocks"
  ADD CONSTRAINT "room_inventory_blocks_hotel_id_fkey"
  FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "room_inventory_blocks"
  ADD CONSTRAINT "room_inventory_blocks_room_id_fkey"
  FOREIGN KEY ("room_id") REFERENCES "rooms"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "room_inventory_blocks_hotel_id_start_date_end_date_idx"
  ON "room_inventory_blocks"("hotel_id", "start_date", "end_date");
CREATE INDEX "room_inventory_blocks_room_id_start_date_end_date_idx"
  ON "room_inventory_blocks"("room_id", "start_date", "end_date");
CREATE INDEX "room_inventory_blocks_hotel_id_cancelled_at_idx"
  ON "room_inventory_blocks"("hotel_id", "cancelled_at");
