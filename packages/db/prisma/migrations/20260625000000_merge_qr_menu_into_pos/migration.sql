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

-- ============================================================================
-- QR Menu & In-Room Dining tables
-- Kept in sync with qr_menu_tables.sql — safe to re-run (IF NOT EXISTS /
-- ADD COLUMN IF NOT EXISTS throughout).
-- ============================================================================

-- ── 1. menu_categories ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS menu_categories (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id        UUID        NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  description     TEXT,
  display_order   INTEGER     NOT NULL DEFAULT 0,
  is_available    BOOLEAN     NOT NULL DEFAULT true,
  available_from  TIME,
  available_until TIME,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_menu_categories_hotel
  ON menu_categories(hotel_id, display_order ASC);

-- ── 2. menu_items ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS menu_items (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id        UUID        NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  category_id     UUID        NOT NULL REFERENCES menu_categories(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  description     TEXT,
  price           BIGINT      NOT NULL CHECK (price >= 0),
  image_url       TEXT,
  is_available    BOOLEAN     NOT NULL DEFAULT true,
  is_featured     BOOLEAN     NOT NULL DEFAULT false,
  display_order   INTEGER     NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_menu_items_hotel_cat
  ON menu_items(hotel_id, category_id, display_order ASC);

CREATE INDEX IF NOT EXISTS idx_menu_items_featured
  ON menu_items(hotel_id, is_featured)
  WHERE is_featured = true;

-- ── 3. qr_orders ─────────────────────────────────────────────────────────────
-- payment_preference drives the folio auto-post on delivery.
-- requires_folio_review is set when an already-posted order is edited.
CREATE TABLE IF NOT EXISTS qr_orders (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id              UUID        NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  order_number          TEXT        NOT NULL,
  guest_name            TEXT        NOT NULL,
  guest_phone           TEXT        NOT NULL,
  room_number           TEXT        NOT NULL,
  room_verified         BOOLEAN     NOT NULL DEFAULT false,
  reservation_id        UUID,
  delivery_type         TEXT        NOT NULL
                          CHECK (delivery_type IN ('room_delivery', 'pickup', 'dine_in')),
  special_instructions  TEXT,
  status                TEXT        NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','confirmed','preparing','ready','delivered','cancelled')),
  total_amount          BIGINT      NOT NULL CHECK (total_amount >= 0),
  folio_id              UUID,
  payment_preference    TEXT        NOT NULL DEFAULT 'charge_to_room'
                          CHECK (payment_preference IN ('charge_to_room', 'pay_now')),
  requires_folio_review BOOLEAN     NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (hotel_id, order_number)
);

-- Safety net for machines where qr_orders was created before these columns existed.
ALTER TABLE qr_orders
  ADD COLUMN IF NOT EXISTS payment_preference    TEXT    NOT NULL DEFAULT 'charge_to_room'
                             CHECK (payment_preference IN ('charge_to_room', 'pay_now')),
  ADD COLUMN IF NOT EXISTS requires_folio_review BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_qr_orders_hotel_status
  ON qr_orders(hotel_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_qr_orders_hotel_date
  ON qr_orders(hotel_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_qr_orders_reservation
  ON qr_orders(reservation_id)
  WHERE reservation_id IS NOT NULL;

-- ── 4. qr_order_items ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS qr_order_items (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id       UUID        NOT NULL REFERENCES qr_orders(id) ON DELETE CASCADE,
  menu_item_id   UUID,
  item_name      TEXT        NOT NULL,
  item_price     BIGINT      NOT NULL,
  quantity       INTEGER     NOT NULL CHECK (quantity > 0),
  special_note   TEXT,
  subtotal       BIGINT      NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qr_order_items_order
  ON qr_order_items(order_id);

-- ── Grants ────────────────────────────────────────────────────────────────────
GRANT ALL ON menu_categories  TO hotel_pms_app;
GRANT ALL ON menu_items        TO hotel_pms_app;
GRANT ALL ON qr_orders         TO hotel_pms_app;
GRANT ALL ON qr_order_items    TO hotel_pms_app;
