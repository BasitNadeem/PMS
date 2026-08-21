ALTER TABLE "room_inventory_blocks"
  ADD COLUMN "maintenance_ticket_id" UUID;

CREATE UNIQUE INDEX "room_inventory_blocks_maintenance_ticket_id_key"
  ON "room_inventory_blocks"("maintenance_ticket_id");

ALTER TABLE "room_inventory_blocks"
  ADD CONSTRAINT "room_inventory_blocks_maintenance_ticket_id_fkey"
  FOREIGN KEY ("maintenance_ticket_id") REFERENCES "maintenance_tickets"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- The old maintenance flow changed operational room state without actually
-- removing inventory from sale. New maintenance exclusions use dated blocks;
-- normalize those legacy transitional states so housekeeping can inspect them.
UPDATE "rooms"
SET "status" = 'VACANT_DIRTY'
WHERE "status" = 'UNDER_MAINTENANCE';
