-- ============================================================================
-- QR Menu & In-Room Dining — canonical table definitions
-- Run once against the database or let the Prisma migration do it.
-- All statements are CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS /
-- ALTER TABLE ADD COLUMN IF NOT EXISTS — safe to re-run on any state.
--
-- DESIGN NOTES
--   • No enable_hotel_rls() calls — consistent with expenses and ledger_entries
--     (accessed exclusively via adminPrisma with explicit hotel_id filtering).
--   • updated_at is maintained by the application layer (SET updated_at = now()
--     in every UPDATE), not via a trigger — same pattern as expenses.
--   • All monetary values in paisas (BIGINT).
--   • Order number format: ORD-0001, ORD-0042, etc. — unique per hotel,
--     generated atomically via pg_advisory_xact_lock inside a transaction.
--   • payment_preference: 'charge_to_room' | 'pay_now' — drives folio auto-post.
--   • requires_folio_review: set to true by QrOrderService.editOrder when items
--     are changed after the order has already been posted to a folio.
-- ============================================================================


-- INTENTIONAL: RLS is NOT enabled on these tables, consistent with
-- expenses/cash_accounts/whatsapp_briefing_logs. Access is exclusively via
-- adminPrisma with explicit hotel_id predicates in every query (see
-- QrOrderService.ts, QrMenuService.ts). qr_orders/qr_order_items contain guest
-- PII (name, phone) — if these tables are ever queried from a new code path,
-- that path MUST include an explicit hotel_id filter. Do not assume RLS
-- provides isolation here.

-- ── 1. menu_categories ───────────────────────────────────────────────────────
-- Hotel-managed menu sections (e.g. "Breakfast", "Beverages", "Main Course").
-- available_from / available_until are TIME values (e.g. '07:00', '10:30').
-- Both NULL means always available.

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
-- Individual dishes / drinks. price in paisas. image_url is an external URL.

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
-- Orders placed by guests via the QR menu.
-- room_verified = true only when the submitted room number was matched to an
-- active CHECKED_IN reservation.
-- payment_preference drives the folio auto-post on delivery.
-- folio_id is set once the order total is posted to the guest's room folio.
-- requires_folio_review is set to true when an already-posted order is edited.

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
  subtotal_amount       BIGINT      NOT NULL DEFAULT 0 CHECK (subtotal_amount >= 0),
  tax_amount            BIGINT      NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  total_amount          BIGINT      NOT NULL CHECK (total_amount >= 0),
  folio_id              UUID,
  payment_preference    TEXT        NOT NULL DEFAULT 'charge_to_room'
                          CHECK (payment_preference IN ('charge_to_room', 'pay_now')),
  requires_folio_review BOOLEAN     NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (hotel_id, order_number)
);

-- Safety net: ADD COLUMN IF NOT EXISTS for machines that had the table created
-- before payment_preference and requires_folio_review were added.
ALTER TABLE qr_orders
  ADD COLUMN IF NOT EXISTS payment_preference    TEXT    NOT NULL DEFAULT 'charge_to_room'
                             CHECK (payment_preference IN ('charge_to_room', 'pay_now')),
  ADD COLUMN IF NOT EXISTS requires_folio_review BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS subtotal_amount       BIGINT  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount            BIGINT  NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_qr_orders_hotel_status
  ON qr_orders(hotel_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_qr_orders_hotel_date
  ON qr_orders(hotel_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_qr_orders_reservation
  ON qr_orders(reservation_id)
  WHERE reservation_id IS NOT NULL;


-- ── 4. qr_order_items ────────────────────────────────────────────────────────
-- Line items. item_name and item_price are snapshots taken at order time so
-- menu edits never change historical records.
-- menu_item_id is nullable in case the menu item is later deleted.

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
