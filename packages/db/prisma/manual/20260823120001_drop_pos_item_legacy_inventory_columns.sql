-- PHASE 2 — run only AFTER the API has been restarted on the build that reads
-- pos_item_ingredients. Deliberately NOT a Prisma migration: `migrate deploy`
-- would apply it in the same breath as phase 1, dropping the columns while the
-- old build is still serving traffic, and every POS menu query would 500 until
-- the restart completed.
--
-- Before running, confirm the backfill landed:
--   SELECT count(*) FROM pos_items
--    WHERE inventory_item_id IS NOT NULL AND inventory_qty_used > 0;
--   SELECT count(DISTINCT pos_item_id) FROM pos_item_ingredients;
-- The second number must be >= the first.
--
-- After running, delete inventoryItemId / inventoryQtyUsed and the
-- inventoryItem relation from model PosItem in schema.prisma.

ALTER TABLE "pos_items" DROP CONSTRAINT IF EXISTS "pos_items_inventory_item_id_fkey";
DROP INDEX IF EXISTS "pos_items_inventory_item_id_idx";
ALTER TABLE "pos_items" DROP COLUMN IF EXISTS "inventory_item_id";
ALTER TABLE "pos_items" DROP COLUMN IF EXISTS "inventory_qty_used";
