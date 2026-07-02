-- ============================================================================
-- Ensure Complete Schema
-- Idempotent safety-net migration — safe to run on any state of the database.
-- All statements use IF NOT EXISTS / ADD COLUMN IF NOT EXISTS so this is
-- fully re-runnable without errors whether the DB is fresh or already set up.
--
-- Purpose:
--   1. Re-create all raw-SQL tables in case earlier migrations were not run
--      (e.g. a machine that jumped from 0001_init to this migration directly).
--   2. Add any columns introduced AFTER the initial CREATE TABLE in earlier
--      migrations via ADD COLUMN IF NOT EXISTS safety nets.
--   3. Re-create all indexes as IF NOT EXISTS.
--   4. Grant access on all raw-SQL tables to the application role.
--
-- NOTE: Prisma-managed tables (those in schema.prisma) are handled entirely
--       by 0001_init + subsequent Prisma migrations. This file only covers
--       the tables that were created via hand-written raw SQL migrations.
-- ============================================================================

-- ── 1. expenses ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expenses (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id       UUID         NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  date           DATE         NOT NULL,
  category       VARCHAR(50)  NOT NULL,
  description    TEXT         NOT NULL,
  amount         INTEGER      NOT NULL,
  payment_method VARCHAR(50)  NOT NULL,
  paid_to        VARCHAR(255) NOT NULL,
  receipt_ref    VARCHAR(255),
  notes          TEXT,
  created_by_id  UUID         NOT NULL REFERENCES users(id),
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS expenses_hotel_id_idx      ON expenses(hotel_id);
CREATE INDEX IF NOT EXISTS expenses_hotel_id_date_idx ON expenses(hotel_id, date);
CREATE INDEX IF NOT EXISTS expenses_hotel_id_cat_idx  ON expenses(hotel_id, category);

-- ── 2. whatsapp_briefing_logs ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS whatsapp_briefing_logs (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id         UUID        NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  sent_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  recipient_number VARCHAR(20) NOT NULL,
  message_text     TEXT        NOT NULL,
  status           VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  error_message    TEXT,
  meta_message_id  VARCHAR(255),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wab_logs_hotel_id_idx ON whatsapp_briefing_logs(hotel_id);
CREATE INDEX IF NOT EXISTS wab_logs_sent_at_idx  ON whatsapp_briefing_logs(hotel_id, sent_at);

-- ── 3. cash_accounts ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cash_accounts (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id     UUID         NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  name         VARCHAR(100) NOT NULL,
  account_type VARCHAR(50)  NOT NULL,
  balance      INTEGER      NOT NULL DEFAULT 0,
  is_active    BOOLEAN      NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cash_accounts_hotel_id_idx ON cash_accounts(hotel_id);

-- ── 4. ledger_entries ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ledger_entries (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id       UUID         NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  account_id     UUID         NOT NULL REFERENCES cash_accounts(id),
  entry_type     VARCHAR(20)  NOT NULL,
  amount         INTEGER      NOT NULL,
  balance_after  INTEGER      NOT NULL,
  source_type    VARCHAR(50)  NOT NULL,
  source_id      VARCHAR(255),
  description    TEXT         NOT NULL,
  payment_method VARCHAR(50),
  recorded_by_id UUID         NOT NULL REFERENCES users(id),
  entry_date     DATE         NOT NULL DEFAULT CURRENT_DATE,
  notes          TEXT,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ledger_entries_hotel_id_idx   ON ledger_entries(hotel_id);
CREATE INDEX IF NOT EXISTS ledger_entries_account_id_idx ON ledger_entries(account_id);
CREATE INDEX IF NOT EXISTS ledger_entries_hotel_date_idx ON ledger_entries(hotel_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS ledger_entries_source_idx     ON ledger_entries(source_type, source_id);

-- ── 5. front_desk_notes ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS front_desk_notes (
  id              UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id        UUID      NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  text            TEXT      NOT NULL,
  is_completed    BOOLEAN   NOT NULL DEFAULT false,
  completed_at    TIMESTAMPTZ,
  completed_by_id UUID      REFERENCES users(id),
  created_by_id   UUID      NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS front_desk_notes_hotel_id_idx
  ON front_desk_notes(hotel_id);
CREATE INDEX IF NOT EXISTS front_desk_notes_hotel_id_is_completed_idx
  ON front_desk_notes(hotel_id, is_completed);

-- ── 6. push_subscriptions ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id   UUID        NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint   TEXT        NOT NULL UNIQUE,
  p256dh     TEXT        NOT NULL,
  auth       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx  ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS push_subscriptions_hotel_idx ON push_subscriptions(hotel_id);

-- ── 7. menu_categories ───────────────────────────────────────────────────────
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

-- ── 8. menu_items ────────────────────────────────────────────────────────────
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

-- ── 9. qr_orders ─────────────────────────────────────────────────────────────
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

-- Safety net: add columns introduced after the original CREATE TABLE.
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

-- ── 10. qr_order_items ───────────────────────────────────────────────────────
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

CREATE INDEX IF NOT EXISTS idx_qr_order_items_order ON qr_order_items(order_id);

-- ── Column safety nets for Prisma-managed tables ─────────────────────────────
-- Columns added after initial 0001_init / 20260526173729_init migrations.
-- These are already present in 20260613000000_add_onboarding_and_subdomain_fields
-- and 20260625000000_merge_qr_menu_into_pos, but repeated here as belt-and-
-- suspenders so this migration alone is sufficient on any DB state.

ALTER TABLE hotels
  ADD COLUMN IF NOT EXISTS subdomain            VARCHAR(255) UNIQUE,
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_step      INTEGER NOT NULL DEFAULT 0;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_first_login BOOLEAN     NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS temp_password  VARCHAR(255);

ALTER TABLE pos_categories
  ADD COLUMN IF NOT EXISTS is_qr_visible  BOOLEAN     NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS available_from VARCHAR(5),
  ADD COLUMN IF NOT EXISTS available_until VARCHAR(5);

ALTER TABLE pos_items
  ADD COLUMN IF NOT EXISTS is_qr_visible BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_featured   BOOLEAN NOT NULL DEFAULT false;

-- ── Grants ────────────────────────────────────────────────────────────────────
-- Belt-and-suspenders: apply:rls also runs GRANT ALL ON ALL TABLES, but
-- explicit per-table grants here make each migration self-documenting.
GRANT ALL ON expenses               TO hotel_pms_app;
GRANT ALL ON whatsapp_briefing_logs TO hotel_pms_app;
GRANT ALL ON cash_accounts          TO hotel_pms_app;
GRANT ALL ON ledger_entries         TO hotel_pms_app;
GRANT ALL ON front_desk_notes       TO hotel_pms_app;
GRANT ALL ON push_subscriptions     TO hotel_pms_app;
GRANT ALL ON menu_categories        TO hotel_pms_app;
GRANT ALL ON menu_items             TO hotel_pms_app;
GRANT ALL ON qr_orders              TO hotel_pms_app;
GRANT ALL ON qr_order_items         TO hotel_pms_app;
