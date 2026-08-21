-- Channex channel-manager integration — base infrastructure layer.
--
-- Deliberately minimal. Two things this migration intentionally does NOT do:
--   * No per-date ARI cache table. Availability and rates are computed on demand
--     from rooms / reservation_rooms / rate_plans at sync time.
--   * No new credentials table. Channex config reuses the existing
--     `channel_configs` row with channel_type = 'CHANNEL_MANAGER', storing the
--     API key and channex_property_id in its `credentials` JSONB, and reusing
--     its is_active / sync_inventory / sync_rates / last_sync_* columns.
--
-- Adds:
--   1. External-id columns linking InnFlo entities to their Channex counterparts
--   2. reservations.ota_source — originating sales channel for a Channex booking
--   3. channel_webhook_events — exactly-once ingestion guard shared by the
--      webhook endpoint and the polling fallback. Provider-neutral by design:
--      the two id columns above are genuinely Channex UUIDs, but this table is
--      infrastructure a second channel manager would reuse as-is.

-- AlterTable
ALTER TABLE "room_types"
    ADD COLUMN "channex_room_type_id" TEXT;

-- AlterTable
ALTER TABLE "rate_plans"
    ADD COLUMN "channex_rate_plan_id" TEXT;

-- AlterTable
-- `ota_booking_ref` already exists and carries the Channex booking id.
-- `ota_source` records the originating sales channel as Channex reports it
-- (e.g. "BookingCom", "Airbnb"), which the BookingSource enum cannot express
-- for every OTA Channex supports.
ALTER TABLE "reservations"
    ADD COLUMN "ota_source" TEXT;

-- CreateTable
CREATE TABLE "channel_webhook_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotel_id" UUID NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'CHANNEX',
    "source_key" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "origin" TEXT NOT NULL DEFAULT 'WEBHOOK',
    "payload" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "channel_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- The exactly-once guarantee: a webhook delivery and the polling fallback that
-- both carry the same provider event id collapse to one row. Provider is part
-- of the key so two channel managers cannot collide on a shared id format.
CREATE UNIQUE INDEX "channel_webhook_events_hotel_id_provider_source_key_key"
    ON "channel_webhook_events"("hotel_id", "provider", "source_key");

-- CreateIndex
CREATE INDEX "channel_webhook_events_hotel_id_status_idx"
    ON "channel_webhook_events"("hotel_id", "status");

-- CreateIndex
CREATE INDEX "room_types_hotel_id_channex_room_type_id_idx"
    ON "room_types"("hotel_id", "channex_room_type_id");

-- CreateIndex
CREATE INDEX "rate_plans_hotel_id_channex_rate_plan_id_idx"
    ON "rate_plans"("hotel_id", "channex_rate_plan_id");

-- AddForeignKey
ALTER TABLE "channel_webhook_events"
    ADD CONSTRAINT "channel_webhook_events_hotel_id_fkey"
    FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
