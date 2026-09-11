-- Recipe lines for POS menu items.
--
-- pos_items.inventory_item_id / inventory_qty_used could only express ONE
-- ingredient per menu item, so a dish like Biryani could deduct chicken or
-- rice, never both. This table replaces that pair with a proper one-to-many.
--
-- Additive only. The legacy columns are backfilled from and left in place so
-- that an API still running the old build survives `migrate deploy` until it
-- restarts; they are dropped in a phase-2 script.

CREATE TABLE "pos_item_ingredients" (
    "id"                UUID         NOT NULL DEFAULT gen_random_uuid(),
    "hotel_id"          UUID         NOT NULL,
    "pos_item_id"       UUID         NOT NULL,
    "inventory_item_id" UUID         NOT NULL,
    "qty_used"          DECIMAL(10,3) NOT NULL,
    "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"        TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pos_item_ingredients_pkey" PRIMARY KEY ("id")
);

-- One line per (menu item, inventory item); quantities are merged, not repeated.
CREATE UNIQUE INDEX "pos_item_ingredients_pos_item_id_inventory_item_id_key"
    ON "pos_item_ingredients"("pos_item_id", "inventory_item_id");
CREATE INDEX "pos_item_ingredients_hotel_id_idx"          ON "pos_item_ingredients"("hotel_id");
CREATE INDEX "pos_item_ingredients_pos_item_id_idx"       ON "pos_item_ingredients"("pos_item_id");
CREATE INDEX "pos_item_ingredients_inventory_item_id_idx" ON "pos_item_ingredients"("inventory_item_id");

ALTER TABLE "pos_item_ingredients" ADD CONSTRAINT "pos_item_ingredients_hotel_id_fkey"
    FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pos_item_ingredients" ADD CONSTRAINT "pos_item_ingredients_pos_item_id_fkey"
    FOREIGN KEY ("pos_item_id") REFERENCES "pos_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- RESTRICT, not SET NULL: an inventory item that a recipe depends on must not
-- silently vanish out of that recipe. Inventory is deactivated, not deleted.
ALTER TABLE "pos_item_ingredients" ADD CONSTRAINT "pos_item_ingredients_inventory_item_id_fkey"
    FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: carry every existing single link over as a one-line recipe.
INSERT INTO "pos_item_ingredients" ("hotel_id", "pos_item_id", "inventory_item_id", "qty_used", "updated_at")
SELECT "hotel_id", "id", "inventory_item_id", "inventory_qty_used", CURRENT_TIMESTAMP
FROM "pos_items"
WHERE "inventory_item_id"  IS NOT NULL
  AND "inventory_qty_used" IS NOT NULL
  AND "inventory_qty_used" > 0
ON CONFLICT ("pos_item_id", "inventory_item_id") DO NOTHING;
