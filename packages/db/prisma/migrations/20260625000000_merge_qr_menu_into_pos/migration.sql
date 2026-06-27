-- Merge the QR guest menu into the POS menu (pos_categories/pos_items).
-- Adds independent QR-visibility fields; the raw qr_menu_tables.sql tables
-- (menu_categories/menu_items) are migrated by a one-off script and then
-- superseded — they are NOT dropped here (qr_order_items.menu_item_id keeps
-- a historical, non-FK-enforced pointer into them for old orders).

ALTER TABLE pos_categories ADD COLUMN IF NOT EXISTS is_qr_visible BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE pos_categories ADD COLUMN IF NOT EXISTS available_from VARCHAR(5);
ALTER TABLE pos_categories ADD COLUMN IF NOT EXISTS available_until VARCHAR(5);

ALTER TABLE pos_items ADD COLUMN IF NOT EXISTS is_qr_visible BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE pos_items ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false;
