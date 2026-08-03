-- ============================================================================
-- Hotel PMS — rls_and_triggers.sql  v2
-- Run AFTER every `prisma migrate deploy`
-- Safe to re-run (idempotent — every statement uses IF NOT EXISTS / OR REPLACE
-- / ON CONFLICT DO NOTHING where applicable)
--
-- SECTIONS
--   1.  Application role setup
--   2.  Session helper functions
--   3.  Row-Level Security (RLS) — tenant isolation
--   4.  Auto-generated reference numbers (triggers)
--   5.  Folio balance auto-recalculation (triggers)
--   6.  Guest stat counters (trigger)
--   7.  Full-text search on guests (trigger + GIN index)
--   8.  updated_at auto-stamp (trigger applied to all tables)
--   9.  Inventory stock level sync (trigger)
--   10. Partial / expression indexes Prisma cannot express
--   11. Useful reporting views
--   12. Seed: system roles
--   13. Seed: permissions
--   14. Seed: role → permission assignments
--   15. Seed: hotel defaults function
--   16. Phase 2 reference notes (commented out)
-- ============================================================================


-- ============================================================================
-- 1. APPLICATION ROLE
-- One Postgres role for the app. All connections use this.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'hotel_pms_app') THEN
    CREATE ROLE hotel_pms_app LOGIN PASSWORD 'CHANGE_IN_PRODUCTION';
  END IF;
END
$$;

GRANT USAGE  ON SCHEMA public TO hotel_pms_app;
GRANT ALL    ON ALL TABLES    IN SCHEMA public TO hotel_pms_app;
GRANT ALL    ON ALL SEQUENCES IN SCHEMA public TO hotel_pms_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES    TO hotel_pms_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO hotel_pms_app;


-- ============================================================================
-- 2. SESSION HELPER FUNCTIONS
--
-- At the start of every request the Fastify middleware runs:
--   SET LOCAL app.current_hotel_id = '<uuid>';
--   SET LOCAL app.current_user_id  = '<uuid>';
--
-- These helpers make the values available inside RLS policies and functions.
-- ============================================================================

CREATE OR REPLACE FUNCTION current_hotel_id()
RETURNS UUID LANGUAGE SQL STABLE AS $$
  SELECT NULLIF(current_setting('app.current_hotel_id', TRUE), '')::UUID;
$$;

CREATE OR REPLACE FUNCTION current_user_id()
RETURNS UUID LANGUAGE SQL STABLE AS $$
  SELECT NULLIF(current_setting('app.current_user_id', TRUE), '')::UUID;
$$;


-- ============================================================================
-- 3. ROW-LEVEL SECURITY
--
-- POLICY DESIGN
--   - Hotel-scoped tables  → hotel_id = current_hotel_id()
--   - users                → id = current_user_id()
--   - roles / permissions  → special read policy (see below)
--   - role_permissions     → permissive (accessed via role FK only)
--   - guest_blacklist      → hotel's own rows + shared rows from any hotel
--
-- HOW TO ADD A NEW TABLE
--   Call: SELECT enable_hotel_rls('your_table_name');
--   That's it — the function enables RLS, forces it, and creates the policy.
-- ============================================================================

-- Reusable helper: enable RLS + create standard hotel isolation policy
CREATE OR REPLACE FUNCTION enable_hotel_rls(p_table TEXT)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',  p_table);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',   p_table);
  EXECUTE format('
    DROP POLICY IF EXISTS hotel_isolation ON %I;
    CREATE POLICY hotel_isolation ON %I
      USING      (hotel_id = current_hotel_id())
      WITH CHECK (hotel_id = current_hotel_id())
  ', p_table, p_table);
END;
$$;

-- ── Hotel-scoped tables (standard isolation) ─────────────────────────────────

-- hotels uses 'id' as its tenant key (not hotel_id — it IS the tenant root)
ALTER TABLE hotels ENABLE ROW LEVEL SECURITY;
ALTER TABLE hotels FORCE   ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hotel_isolation ON hotels;
CREATE POLICY hotel_isolation ON hotels
  USING      (id = current_hotel_id())
  WITH CHECK (id = current_hotel_id());
SELECT enable_hotel_rls('hotel_users');
SELECT enable_hotel_rls('room_types');
SELECT enable_hotel_rls('rooms');
SELECT enable_hotel_rls('guests');
SELECT enable_hotel_rls('guest_special_dates');
SELECT enable_hotel_rls('accounting_accounts');
SELECT enable_hotel_rls('accounting_exports');
SELECT enable_hotel_rls('companies');
SELECT enable_hotel_rls('company_ledger_entries');
SELECT enable_hotel_rls('company_invoices');
SELECT enable_hotel_rls('reservations');
-- reservation_rooms has no hotel_id — handled in open-access section below
SELECT enable_hotel_rls('group_bookings');
-- group_members has no hotel_id — handled in open-access section below
SELECT enable_hotel_rls('folios');
SELECT enable_hotel_rls('folio_items');
-- folio_splits has no hotel_id — handled in open-access section below
SELECT enable_hotel_rls('payments');
SELECT enable_hotel_rls('pos_categories');
SELECT enable_hotel_rls('pos_items');
SELECT enable_hotel_rls('pos_orders');
SELECT enable_hotel_rls('housekeeping_tasks');
SELECT enable_hotel_rls('maintenance_tickets');
SELECT enable_hotel_rls('inventory_items');
SELECT enable_hotel_rls('inventory_transactions');
SELECT enable_hotel_rls('conversations');
SELECT enable_hotel_rls('messages');
SELECT enable_hotel_rls('rate_plans');
SELECT enable_hotel_rls('rate_plan_codes');
SELECT enable_hotel_rls('channel_configs');
SELECT enable_hotel_rls('staff');
SELECT enable_hotel_rls('shift_reports');
SELECT enable_hotel_rls('tax_configs');
SELECT enable_hotel_rls('invoices');
SELECT enable_hotel_rls('audit_logs');
SELECT enable_hotel_rls('notifications');
SELECT enable_hotel_rls('custom_field_definitions');
SELECT enable_hotel_rls('push_subscriptions');
SELECT enable_hotel_rls('front_desk_notes');

-- night_audit_records: hotel column is "hotelId" (camelCase, no @map in schema)
-- Cannot use enable_hotel_rls() which hardcodes hotel_id — inline policy instead.
ALTER TABLE night_audit_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE night_audit_records FORCE   ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hotel_isolation ON night_audit_records;
CREATE POLICY hotel_isolation ON night_audit_records
  USING      ("hotelId" = current_hotel_id())
  WITH CHECK ("hotelId" = current_hotel_id());


-- ── Tables without a direct hotel_id (accessed via parent FK) ────────────────
-- These still get RLS enabled but with a permissive policy.
-- Security is enforced by the parent table's RLS in the JOIN.

DO $$ BEGIN
  -- reservation_rooms: isolated via parent reservations (RLS + CASCADE delete)
  EXECUTE 'ALTER TABLE reservation_rooms ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE reservation_rooms FORCE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS open_access ON reservation_rooms';
  EXECUTE 'CREATE POLICY open_access ON reservation_rooms USING (true)';

  EXECUTE 'ALTER TABLE pos_order_items   ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE pos_order_items   FORCE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS open_access ON pos_order_items';
  EXECUTE 'CREATE POLICY open_access ON pos_order_items USING (true)';

  EXECUTE 'ALTER TABLE rate_plan_items   ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE rate_plan_items   FORCE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS open_access ON rate_plan_items';
  EXECUTE 'CREATE POLICY open_access ON rate_plan_items USING (true)';

  EXECUTE 'ALTER TABLE folio_splits      ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE folio_splits      FORCE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS open_access ON folio_splits';
  EXECUTE 'CREATE POLICY open_access ON folio_splits USING (true)';

  EXECUTE 'ALTER TABLE group_members     ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE group_members     FORCE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS open_access ON group_members';
  EXECUTE 'CREATE POLICY open_access ON group_members USING (true)';

  EXECUTE 'ALTER TABLE custom_field_values ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE custom_field_values FORCE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS open_access ON custom_field_values';
  EXECUTE 'CREATE POLICY open_access ON custom_field_values USING (true)';
END $$;


-- ── users: self-access only ──────────────────────────────────────────────────
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE   ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_self_access ON users;
CREATE POLICY user_self_access ON users
  USING      (id = current_user_id())
  WITH CHECK (id = current_user_id());


-- ── roles: system roles readable by all; custom roles scoped to hotel ────────
-- System roles (hotel_id IS NULL) must be readable by every hotel so the app
-- can load permission sets. Custom roles are hotel-scoped.
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles FORCE   ROW LEVEL SECURITY;
DROP POLICY IF EXISTS roles_access ON roles;
CREATE POLICY roles_access ON roles
  USING (
    hotel_id IS NULL                    -- system role — anyone can read
    OR hotel_id = current_hotel_id()    -- hotel's own custom role
  )
  WITH CHECK (
    hotel_id = current_hotel_id()       -- can only write to own hotel's roles
  );


-- ── permissions: global read — no hotel scope needed ────────────────────────
-- The permissions table is a read-only catalogue. No hotel writes to it.
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions FORCE   ROW LEVEL SECURITY;
DROP POLICY IF EXISTS permissions_read ON permissions;
CREATE POLICY permissions_read ON permissions
  FOR SELECT USING (true);   -- readable by all authenticated sessions


-- ── role_permissions: open (governed by roles RLS above) ────────────────────
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions FORCE   ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rp_access ON role_permissions;
CREATE POLICY rp_access ON role_permissions USING (true);


-- ── guest_blacklist: own rows + shared rows from any hotel ──────────────────
ALTER TABLE guest_blacklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_blacklist FORCE   ROW LEVEL SECURITY;

DROP POLICY IF EXISTS blacklist_own    ON guest_blacklist;
DROP POLICY IF EXISTS blacklist_shared ON guest_blacklist;

-- Read: own entries + any shared entry across all hotels
CREATE POLICY blacklist_own ON guest_blacklist
  FOR SELECT
  USING (hotel_id = current_hotel_id() OR is_shared = true);

-- Write: only to own hotel's entries
DROP POLICY IF EXISTS blacklist_write ON guest_blacklist;
CREATE POLICY blacklist_write ON guest_blacklist
  FOR INSERT WITH CHECK (hotel_id = current_hotel_id());

DROP POLICY IF EXISTS blacklist_update ON guest_blacklist;
CREATE POLICY blacklist_update ON guest_blacklist
  FOR UPDATE USING (hotel_id = current_hotel_id());

DROP POLICY IF EXISTS blacklist_delete ON guest_blacklist;
CREATE POLICY blacklist_delete ON guest_blacklist
  FOR DELETE USING (hotel_id = current_hotel_id());


-- ============================================================================
-- 4. SEQUENCE-BASED REFERENCE NUMBER GENERATORS
-- Human-readable, year-prefixed, zero-padded identifiers.
-- Triggers set these automatically on INSERT.
-- ============================================================================

CREATE SEQUENCE IF NOT EXISTS seq_reservation  START 1 CACHE 10;
CREATE SEQUENCE IF NOT EXISTS seq_folio        START 1 CACHE 10;
CREATE SEQUENCE IF NOT EXISTS seq_pos_order    START 1 CACHE 10;
CREATE SEQUENCE IF NOT EXISTS seq_maintenance  START 1 CACHE 10;
CREATE SEQUENCE IF NOT EXISTS seq_invoice      START 1 CACHE 10;

-- Format helpers
CREATE OR REPLACE FUNCTION next_confirmation_number()
RETURNS TEXT LANGUAGE plpgsql AS $$
BEGIN
  RETURN 'HPM-' || TO_CHAR(NOW(), 'YYYY') || '-'
         || LPAD(NEXTVAL('seq_reservation')::TEXT, 5, '0');
END;
$$;

CREATE OR REPLACE FUNCTION next_folio_number()
RETURNS TEXT LANGUAGE plpgsql AS $$
BEGIN
  RETURN 'F-' || TO_CHAR(NOW(), 'YYYY') || '-'
         || LPAD(NEXTVAL('seq_folio')::TEXT, 6, '0');
END;
$$;

CREATE OR REPLACE FUNCTION next_pos_order_number()
RETURNS TEXT LANGUAGE plpgsql AS $$
BEGIN
  RETURN 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-'
         || LPAD(NEXTVAL('seq_pos_order')::TEXT, 4, '0');
END;
$$;

CREATE OR REPLACE FUNCTION next_maintenance_number()
RETURNS TEXT LANGUAGE plpgsql AS $$
BEGIN
  RETURN 'MNT-' || TO_CHAR(NOW(), 'YYYY') || '-'
         || LPAD(NEXTVAL('seq_maintenance')::TEXT, 5, '0');
END;
$$;

CREATE OR REPLACE FUNCTION next_invoice_number()
RETURNS TEXT LANGUAGE plpgsql AS $$
BEGIN
  RETURN 'INV-' || TO_CHAR(NOW(), 'YYYY') || '-'
         || LPAD(NEXTVAL('seq_invoice')::TEXT, 6, '0');
END;
$$;

-- Trigger functions
CREATE OR REPLACE FUNCTION trg_set_confirmation_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.confirmation_number IS NULL OR NEW.confirmation_number = '' THEN
    NEW.confirmation_number := next_confirmation_number();
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION trg_set_folio_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.folio_number IS NULL OR NEW.folio_number = '' THEN
    NEW.folio_number := next_folio_number();
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION trg_set_pos_order_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := next_pos_order_number();
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION trg_set_maintenance_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.ticket_number IS NULL OR NEW.ticket_number = '' THEN
    NEW.ticket_number := next_maintenance_number();
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION trg_set_invoice_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    NEW.invoice_number := next_invoice_number();
  END IF;
  RETURN NEW;
END;
$$;

-- Attach triggers
DROP TRIGGER IF EXISTS set_confirmation_number ON reservations;
CREATE TRIGGER set_confirmation_number
  BEFORE INSERT ON reservations
  FOR EACH ROW EXECUTE FUNCTION trg_set_confirmation_number();

DROP TRIGGER IF EXISTS set_folio_number ON folios;
CREATE TRIGGER set_folio_number
  BEFORE INSERT ON folios
  FOR EACH ROW EXECUTE FUNCTION trg_set_folio_number();

DROP TRIGGER IF EXISTS set_pos_order_number ON pos_orders;
CREATE TRIGGER set_pos_order_number
  BEFORE INSERT ON pos_orders
  FOR EACH ROW EXECUTE FUNCTION trg_set_pos_order_number();

DROP TRIGGER IF EXISTS set_maintenance_number ON maintenance_tickets;
CREATE TRIGGER set_maintenance_number
  BEFORE INSERT ON maintenance_tickets
  FOR EACH ROW EXECUTE FUNCTION trg_set_maintenance_number();

DROP TRIGGER IF EXISTS set_invoice_number ON invoices;
CREATE TRIGGER set_invoice_number
  BEFORE INSERT ON invoices
  FOR EACH ROW EXECUTE FUNCTION trg_set_invoice_number();


-- ============================================================================
-- 5. FOLIO BALANCE AUTO-RECALCULATION
--
-- folio.balance_due, charges_total, tax_total, payments_total are
-- DENORMALISED for read performance. This trigger keeps them accurate.
-- NEVER manually update these columns — let the trigger handle it.
--
-- Fires after any INSERT / UPDATE / DELETE on folio_items or payments.
-- ============================================================================

CREATE OR REPLACE FUNCTION recalculate_folio_balance(p_folio_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_charges   BIGINT;
  v_discounts BIGINT;
  v_taxes     BIGINT;
  v_payments  BIGINT;
BEGIN
  -- Sum all non-voided items by semantic type
  SELECT
    COALESCE(SUM(CASE WHEN type NOT IN ('DISCOUNT','TAX') AND NOT is_voided
                      THEN net_amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type = 'DISCOUNT'             AND NOT is_voided
                      THEN amount    ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type = 'TAX'                  AND NOT is_voided
                      THEN amount    ELSE 0 END), 0)
  INTO v_charges, v_discounts, v_taxes
  FROM folio_items
  WHERE folio_id = p_folio_id;

  -- Sum completed payments only
  SELECT COALESCE(SUM(amount), 0)
  INTO v_payments
  FROM payments
  WHERE folio_id = p_folio_id
    AND status   = 'COMPLETED';

  UPDATE folios SET
    charges_total   = v_charges,
    discounts_total = v_discounts,
    tax_total       = v_taxes,
    payments_total  = v_payments,
    balance_due     = v_charges - v_discounts + v_taxes - v_payments,
    updated_at      = NOW()
  WHERE id = p_folio_id;
END;
$$;

-- Trigger function for folio_items changes
CREATE OR REPLACE FUNCTION trg_folio_item_changed()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM recalculate_folio_balance(OLD.folio_id);
  ELSE
    PERFORM recalculate_folio_balance(NEW.folio_id);
    -- If folio_id changed (item moved between folios) recalc both
    IF TG_OP = 'UPDATE' AND OLD.folio_id <> NEW.folio_id THEN
      PERFORM recalculate_folio_balance(OLD.folio_id);
    END IF;
  END IF;
  RETURN NULL;  -- AFTER trigger; return value ignored
END;
$$;

DROP TRIGGER IF EXISTS folio_item_changed ON folio_items;
CREATE TRIGGER folio_item_changed
  AFTER INSERT OR UPDATE OR DELETE ON folio_items
  FOR EACH ROW EXECUTE FUNCTION trg_folio_item_changed();

-- Trigger function for payment changes
CREATE OR REPLACE FUNCTION trg_payment_changed()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.folio_id IS NOT NULL THEN
      PERFORM recalculate_folio_balance(OLD.folio_id);
    END IF;
  ELSE
    IF NEW.folio_id IS NOT NULL THEN
      PERFORM recalculate_folio_balance(NEW.folio_id);
    END IF;
    -- If folio assignment changed, recalc old folio too
    IF TG_OP = 'UPDATE'
       AND OLD.folio_id IS NOT NULL
       AND OLD.folio_id IS DISTINCT FROM NEW.folio_id THEN
      PERFORM recalculate_folio_balance(OLD.folio_id);
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS payment_changed ON payments;
CREATE TRIGGER payment_changed
  AFTER INSERT OR UPDATE OR DELETE ON payments
  FOR EACH ROW EXECUTE FUNCTION trg_payment_changed();


-- ============================================================================
-- 6. GUEST STAT COUNTERS
-- total_stays and total_spend on the guests table are denormalised
-- for fast VIP/repeat-guest lookups. Updated on checkout only.
-- ============================================================================

CREATE OR REPLACE FUNCTION trg_update_guest_stats()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Only fire when status transitions TO 'CHECKED_OUT'
  IF NEW.status = 'CHECKED_OUT'
     AND (OLD.status IS DISTINCT FROM 'CHECKED_OUT') THEN

    UPDATE guests SET
      total_stays = total_stays + 1,
      total_spend = total_spend + COALESCE((
        SELECT charges_total - discounts_total + tax_total
        FROM   folios
        WHERE  reservation_id = NEW.id
      ), 0),
      updated_at  = NOW()
    WHERE id = NEW.guest_id;

  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_guest_stats ON reservations;
CREATE TRIGGER update_guest_stats
  AFTER UPDATE ON reservations
  FOR EACH ROW EXECUTE FUNCTION trg_update_guest_stats();


-- ============================================================================
-- 7. FULL-TEXT SEARCH ON GUESTS
-- Enables fast fuzzy search across name, phone, document number, email, city.
-- The search_guests() function is what the application calls.
-- ============================================================================

-- Ensure the column exists (Prisma maps Unsupported("tsvector") but doesn't
-- always create it on older migrations)
ALTER TABLE guests
  ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Trigger to regenerate the vector on every guest write
CREATE OR REPLACE FUNCTION trg_guest_search_vector()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- 'simple' dictionary keeps numbers intact (critical for CNIC matching)
  NEW.search_vector :=
    setweight(to_tsvector('simple', COALESCE(NEW.full_name,       '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(NEW.phone,           '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(NEW.document_number, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(NEW.email,           '')), 'C') ||
    setweight(to_tsvector('simple', COALESCE(NEW.city,            '')), 'D');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guest_search_vector ON guests;
CREATE TRIGGER guest_search_vector
  BEFORE INSERT OR UPDATE ON guests
  FOR EACH ROW EXECUTE FUNCTION trg_guest_search_vector();

-- GIN index for fast FTS queries
CREATE INDEX IF NOT EXISTS idx_guests_search_gin
  ON guests USING GIN(search_vector);

-- Trigger to keep full_name denormalised
CREATE OR REPLACE FUNCTION trg_guest_full_name()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.full_name :=
    TRIM(COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, ''));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guest_full_name ON guests;
CREATE TRIGGER guest_full_name
  BEFORE INSERT OR UPDATE OF first_name, last_name ON guests
  FOR EACH ROW EXECUTE FUNCTION trg_guest_full_name();

-- Application-facing search function
-- Usage:  SELECT * FROM search_guests('<hotel_id>', 'Ali Khan', 20);
CREATE OR REPLACE FUNCTION search_guests(
  p_hotel_id UUID,
  p_query    TEXT,
  p_limit    INT DEFAULT 20
)
RETURNS TABLE (
  id              UUID,
  full_name       TEXT,
  phone           TEXT,
  document_number TEXT,
  email           TEXT,
  total_stays     INT,
  rank            FLOAT4
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_tsquery tsquery;
BEGIN
  -- Build a safe tsquery; fall back to prefix match if query is too short
  BEGIN
    v_tsquery := plainto_tsquery('simple', p_query);
  EXCEPTION WHEN OTHERS THEN
    v_tsquery := NULL;
  END;

  RETURN QUERY
  SELECT
    g.id,
    g.full_name,
    g.phone,
    g.document_number,
    g.email,
    g.total_stays,
    CASE
      WHEN v_tsquery IS NOT NULL THEN ts_rank(g.search_vector, v_tsquery)
      ELSE 0::FLOAT4
    END AS rank
  FROM guests g
  WHERE g.hotel_id   = p_hotel_id
    AND g.deleted_at IS NULL
    AND (
      (v_tsquery IS NOT NULL AND g.search_vector @@ v_tsquery)
      OR g.full_name       ILIKE '%' || p_query || '%'
      OR g.phone            LIKE '%' || p_query || '%'
      OR g.document_number  LIKE '%' || p_query || '%'
    )
  ORDER BY rank DESC, g.total_stays DESC
  LIMIT p_limit;
END;
$$;


-- ============================================================================
-- 8. UPDATED_AT AUTO-STAMP
-- Applied to every table that has an updated_at column.
-- Prisma also sets this via @updatedAt, but having a DB trigger is a safety
-- net for any raw SQL updates that bypass Prisma.
-- ============================================================================

CREATE OR REPLACE FUNCTION trg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT table_name
    FROM   information_schema.columns
    WHERE  table_schema = 'public'
      AND  column_name  = 'updated_at'
  LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS set_updated_at ON %I;
      CREATE TRIGGER set_updated_at
        BEFORE UPDATE ON %I
        FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at()
    ', tbl, tbl);
  END LOOP;
END;
$$;


-- ============================================================================
-- 9. INVENTORY STOCK LEVEL SYNC
-- Keeps inventory_items.current_stock accurate after each transaction.
-- Triggered by INSERT on inventory_transactions only (transactions are
-- immutable once written — no UPDATE/DELETE allowed).
-- ============================================================================

CREATE OR REPLACE FUNCTION trg_update_inventory_stock()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_delta DECIMAL(12,3);
BEGIN
  CASE NEW.type
    WHEN 'PURCHASE'      THEN v_delta :=  NEW.quantity;
    WHEN 'OPENING_STOCK' THEN v_delta :=  NEW.quantity;
    WHEN 'ADJUSTMENT'    THEN v_delta :=  NEW.quantity;  -- may be negative
    WHEN 'TRANSFER'      THEN v_delta :=  NEW.quantity;  -- sign set by caller
    WHEN 'CONSUMPTION'   THEN v_delta := -NEW.quantity;
    WHEN 'WASTE'         THEN v_delta := -NEW.quantity;
    ELSE v_delta := 0;
  END CASE;

  UPDATE inventory_items SET
    current_stock = current_stock + v_delta,
    updated_at    = NOW()
  WHERE id = NEW.item_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS inventory_stock_sync ON inventory_transactions;
CREATE TRIGGER inventory_stock_sync
  AFTER INSERT ON inventory_transactions
  FOR EACH ROW EXECUTE FUNCTION trg_update_inventory_stock();


-- ============================================================================
-- 10. PARTIAL / EXPRESSION INDEXES
-- These cannot be expressed in Prisma schema (@@index does not support WHERE
-- clauses or expressions). Run them here.
-- ============================================================================

-- ── Reservations ──────────────────────────────────────────────────────────────
-- Future arrivals only (biggest calendar query)
-- CURRENT_DATE not allowed in index predicates (STABLE, not IMMUTABLE)
CREATE INDEX IF NOT EXISTS idx_res_future_arrivals
  ON reservations (hotel_id, check_in_date)
  WHERE status IN ('CONFIRMED', 'CHECKED_IN');

-- Open reservations only
CREATE INDEX IF NOT EXISTS idx_res_open
  ON reservations (hotel_id, status)
  WHERE status IN ('CONFIRMED', 'CHECKED_IN');

-- ── Rooms ──────────────────────────────────────────────────────────────────────
-- Available rooms (active and not out-of-order)
CREATE INDEX IF NOT EXISTS idx_rooms_available
  ON rooms (hotel_id, room_type_id)
  WHERE is_active = true
    AND status NOT IN ('OUT_OF_ORDER', 'UNDER_MAINTENANCE');

-- ── Reservation rooms (availability check) ────────────────────────────────────
-- Only future / current bookings matter for availability
CREATE INDEX IF NOT EXISTS idx_resrooms_calendar
  ON reservation_rooms (room_id, check_in_date, check_out_date);

-- ── Folios ────────────────────────────────────────────────────────────────────
-- Open folios (shift-end reconciliation, manager dashboard)
CREATE INDEX IF NOT EXISTS idx_folios_open
  ON folios (hotel_id)
  WHERE is_open = true;

-- Folios with outstanding balance (collection follow-up)
CREATE INDEX IF NOT EXISTS idx_folios_outstanding
  ON folios (hotel_id, balance_due)
  WHERE is_open = true AND balance_due > 0;

-- ── POS Orders ────────────────────────────────────────────────────────────────
-- Unposted orders (kitchen billing run)
CREATE INDEX IF NOT EXISTS idx_pos_unposted
  ON pos_orders (hotel_id, created_at)
  WHERE is_posted_to_folio = false;

-- ── Housekeeping ──────────────────────────────────────────────────────────────
-- Today's pending tasks (housekeeping app)
CREATE INDEX IF NOT EXISTS idx_hk_today_pending
  ON housekeeping_tasks (hotel_id, room_id)
  WHERE status IN ('PENDING', 'IN_PROGRESS');

-- Escalated issues (manager alert feed)
CREATE INDEX IF NOT EXISTS idx_hk_escalated
  ON housekeeping_tasks (hotel_id, created_at DESC)
  WHERE is_escalated = true;

-- ── Maintenance ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_maint_open
  ON maintenance_tickets (hotel_id, priority DESC, created_at DESC)
  WHERE status IN ('OPEN', 'IN_PROGRESS');

-- ── Inventory ─────────────────────────────────────────────────────────────────
-- Low-stock alert (WHERE current_stock <= reorder_level)
CREATE INDEX IF NOT EXISTS idx_inv_low_stock
  ON inventory_items (hotel_id, category)
  WHERE is_active = true
    AND current_stock <= reorder_level;

-- ── Messages ──────────────────────────────────────────────────────────────────
-- Undelivered outbound (retry job)
CREATE INDEX IF NOT EXISTS idx_msg_pending_outbound
  ON messages (hotel_id, created_at)
  WHERE direction = 'OUTBOUND'
    AND status IN ('PENDING_SEND', 'FAILED');

-- ── Conversations ─────────────────────────────────────────────────────────────
-- Unread open conversations (inbox badge count)
CREATE INDEX IF NOT EXISTS idx_conv_unread
  ON conversations (hotel_id, last_message_at DESC)
  WHERE is_open = true AND is_read = false;

-- Snoozed conversations due for wake-up
CREATE INDEX IF NOT EXISTS idx_conv_snoozed
  ON conversations (hotel_id, snoozed_until)
  WHERE is_snoozed = true;

-- ── Guests ────────────────────────────────────────────────────────────────────
-- Foreigner list for compliance export
CREATE INDEX IF NOT EXISTS idx_guests_foreigner
  ON guests (hotel_id, created_at)
  WHERE is_foreigner = true AND deleted_at IS NULL;

-- Blacklisted guests (check at every check-in)
CREATE INDEX IF NOT EXISTS idx_guests_blacklisted
  ON guests (hotel_id, document_number)
  WHERE is_blacklisted = true AND deleted_at IS NULL;

-- ── Payments ──────────────────────────────────────────────────────────────────
-- Pending payments (follow-up queue)
CREATE INDEX IF NOT EXISTS idx_payments_pending
  ON payments (hotel_id, posted_at)
  WHERE status = 'PENDING';

-- ── Audit log ─────────────────────────────────────────────────────────────────
-- Recent login events (security monitor)
CREATE INDEX IF NOT EXISTS idx_audit_logins
  ON audit_logs (hotel_id, created_at DESC)
  WHERE action = 'LOGIN';

-- ── Roles ─────────────────────────────────────────────────────────────────────
-- System roles (hotel_id IS NULL) — loaded on every permission cache rebuild
CREATE INDEX IF NOT EXISTS idx_roles_system
  ON roles (name)
  WHERE hotel_id IS NULL AND is_system = true;

-- ── Users ─────────────────────────────────────────────────────────────────────
-- Active users only (session validation)
CREATE INDEX IF NOT EXISTS idx_users_active
  ON users (email)
  WHERE deleted_at IS NULL;


-- ============================================================================
-- 11. REPORTING VIEWS
-- Read-only. No RLS needed because hotel_id is always in the WHERE clause
-- in every query against these views.
-- ============================================================================

-- Daily occupancy stats — used by owner briefing job and reports module
CREATE OR REPLACE VIEW v_daily_occupancy AS
SELECT
  r.hotel_id,
  rr.check_in_date                                                    AS stat_date,
  COUNT(DISTINCT rr.room_id)                                          AS occupied_rooms,
  (
    SELECT COUNT(*) FROM rooms rm
    WHERE  rm.hotel_id = r.hotel_id AND rm.is_active = true
  )                                                                   AS total_rooms,
  ROUND(
    COUNT(DISTINCT rr.room_id)::NUMERIC /
    NULLIF((
      SELECT COUNT(*) FROM rooms rm
      WHERE  rm.hotel_id = r.hotel_id AND rm.is_active = true
    ), 0) * 100, 1
  )                                                                   AS occupancy_pct,
  SUM(rr.rate_per_night)                                              AS room_revenue,
  ROUND(
    SUM(rr.rate_per_night)::NUMERIC /
    NULLIF(COUNT(DISTINCT rr.room_id), 0), 0
  )                                                                   AS adr
FROM   reservation_rooms rr
JOIN   reservations r ON rr.reservation_id = r.id
WHERE  r.status IN ('CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT')
GROUP  BY r.hotel_id, rr.check_in_date;


-- Today's summary — one row per hotel, used by nightly WhatsApp briefing job
CREATE OR REPLACE VIEW v_today_summary AS
SELECT
  h.id                                                               AS hotel_id,
  h.name                                                             AS hotel_name,
  -- Total rooms
  (SELECT COUNT(*) FROM rooms r
   WHERE r.hotel_id = h.id AND r.is_active = true)                  AS total_rooms,
  -- Currently occupied
  (SELECT COUNT(*) FROM reservation_rooms rr
   JOIN reservations res ON rr.reservation_id = res.id
   WHERE res.hotel_id   = h.id
     AND res.status     = 'CHECKED_IN'
     AND rr.check_in_date  <= CURRENT_DATE
     AND rr.check_out_date  > CURRENT_DATE)                         AS occupied_rooms,
  -- Arrivals today
  (SELECT COUNT(*) FROM reservations res
   WHERE res.hotel_id     = h.id
     AND res.check_in_date = CURRENT_DATE
     AND res.status        = 'CONFIRMED')                            AS arrivals_today,
  -- Departures today
  (SELECT COUNT(*) FROM reservations res
   WHERE res.hotel_id      = h.id
     AND res.check_out_date = CURRENT_DATE
     AND res.status         = 'CHECKED_IN')                          AS departures_today,
  -- Revenue collected today
  (SELECT COALESCE(SUM(p.amount), 0)
   FROM payments p
   WHERE p.hotel_id = h.id
     AND p.status   = 'COMPLETED'
     AND DATE(p.posted_at) = CURRENT_DATE)                          AS revenue_today,
  -- Unread messages
  (SELECT COUNT(*) FROM conversations c
   WHERE c.hotel_id = h.id
     AND c.is_open  = true
     AND c.is_read  = false)                                         AS unread_messages,
  -- Cash variance (sum of shift variances today)
  (SELECT COALESCE(SUM(ABS(sr.variance)), 0)
   FROM shift_reports sr
   WHERE sr.hotel_id   = h.id
     AND sr.shift_date = CURRENT_DATE)                              AS cash_variance_today
FROM hotels h
WHERE h.is_active  = true
  AND h.deleted_at IS NULL;


-- Channel performance — used by reports module
CREATE OR REPLACE VIEW v_channel_performance AS
SELECT
  r.hotel_id,
  r.source                                                           AS channel,
  DATE_TRUNC('month', r.created_at)                                 AS month,
  COUNT(*)                                                           AS total_bookings,
  COUNT(*) FILTER (WHERE r.status = 'CHECKED_OUT')                  AS completed_stays,
  COUNT(*) FILTER (WHERE r.status = 'NO_SHOW')                      AS no_shows,
  ROUND(
    COUNT(*) FILTER (WHERE r.status = 'NO_SHOW')::NUMERIC /
    NULLIF(COUNT(*), 0) * 100, 1
  )                                                                  AS no_show_rate_pct,
  COALESCE(SUM(r.total_amount), 0)                                  AS gross_revenue,
  ROUND(AVG(r.total_amount), 0)                                     AS avg_booking_value
FROM reservations r
GROUP BY r.hotel_id, r.source, DATE_TRUNC('month', r.created_at);


-- Room availability helper — used by booking calendar
CREATE OR REPLACE FUNCTION get_available_rooms(
  p_hotel_id     UUID,
  p_check_in     DATE,
  p_check_out    DATE,
  p_room_type_id UUID DEFAULT NULL
)
RETURNS TABLE (
  room_id      UUID,
  room_number  TEXT,
  room_type_id UUID,
  room_type    TEXT,
  floor        INT,
  status       TEXT,
  default_rate INT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id,
    r.number,
    r.room_type_id,
    rt.name,
    r.floor,
    r.status::TEXT,
    rt.default_rate
  FROM   rooms r
  JOIN   room_types rt ON r.room_type_id = rt.id
  WHERE  r.hotel_id  = p_hotel_id
    AND  r.is_active = true
    AND  r.status NOT IN ('OUT_OF_ORDER', 'UNDER_MAINTENANCE', 'BLOCKED')
    AND  (p_room_type_id IS NULL OR r.room_type_id = p_room_type_id)
    AND  r.id NOT IN (
           SELECT rr.room_id
           FROM   reservation_rooms rr
           JOIN   reservations res ON rr.reservation_id = res.id
           WHERE  res.hotel_id = p_hotel_id
             AND  res.status IN ('CONFIRMED', 'CHECKED_IN')
             AND  rr.check_in_date  < p_check_out
             AND  rr.check_out_date > p_check_in
         )
  ORDER BY r.floor NULLS LAST, r.number;
END;
$$;


-- ============================================================================
-- 12. SEED: SYSTEM ROLES
-- hotelId IS NULL = applies to every hotel on the platform.
-- These rows are reference data, not configuration.
-- ============================================================================

INSERT INTO roles
  (name, display_name, description, color, is_system, is_custom, sort_order, created_at, updated_at)
VALUES
  ('OWNER',        'Owner',
   'Full access to all features, settings and financial data.',
   '#1F3F5C', true, false, 1, NOW(), NOW()),

  ('MANAGER',      'Manager',
   'Full operational access. Cannot change hotel settings or view audit log.',
   '#15803D', true, false, 2, NOW(), NOW()),

  ('FRONT_DESK',   'Front Desk',
   'Reservations, check-in/out, folio management and payment processing.',
   '#B45309', true, false, 3, NOW(), NOW()),

  ('HOUSEKEEPING', 'Housekeeping',
   'Room status updates, housekeeping tasks, maintenance and supplies.',
   '#6B21A8', true, false, 4, NOW(), NOW()),

  ('KITCHEN',      'Kitchen',
   'View and manage POS orders and kitchen inventory only.',
   '#0F766E', true, false, 5, NOW(), NOW()),

  ('MAINTENANCE',  'Maintenance',
   'Maintenance tickets, room inspections and asset management.',
   '#9A3412', true, false, 6, NOW(), NOW()),

  ('ACCOUNTANT',   'Accountant',
   'Financial reports, payment reconciliation, shift sign-off and FBR invoicing.',
   '#374151', true, false, 7, NOW(), NOW())
-- Targets roles_system_name_key (partial unique index on name WHERE hotel_id
-- IS NULL, added by migration 20260706000000_dedupe_system_roles_and_fix_constraint).
-- The old `ON CONFLICT (hotel_id, name)` here never actually matched these
-- rows — a plain composite unique index doesn't treat NULL hotel_id as a
-- conflict, so every re-run of this script (it's meant to be re-run after
-- every migrate deploy) inserted 7 fresh duplicate system roles.
ON CONFLICT (name) WHERE hotel_id IS NULL DO NOTHING;


-- ============================================================================
-- 13. SEED: PERMISSIONS
-- One row per discrete action in the system.
-- key format: "<module>:<action>" — must match the Permission type in
-- packages/utils/src/permissions.ts exactly.
-- ============================================================================

INSERT INTO permissions (key, module, action, display_name, description)
VALUES
  -- ── Reservations ──────────────────────────────────────────────────────────
  ('reservations:view',
   'reservations', 'view',
   'View Reservations',
   'Access the booking calendar and view reservation details'),

  ('reservations:create',
   'reservations', 'create',
   'Create Reservations',
   'Create new bookings from any source (walk-in, phone, OTA)'),

  ('reservations:edit',
   'reservations', 'edit',
   'Edit Reservations',
   'Modify dates, room assignment and guest details on existing reservations'),

  ('reservations:cancel',
   'reservations', 'cancel',
   'Cancel Reservations',
   'Cancel confirmed or checked-in reservations and apply cancellation fees'),

  -- ── Guests ────────────────────────────────────────────────────────────────
  ('guests:view',
   'guests', 'view',
   'View Guests',
   'Access guest profiles, stay history and preferences'),

  ('guests:view-sensitive',
   'guests', 'view',
   'View Sensitive Guest Data',
   'View CNIC numbers, passport details and date of birth'),

  ('guests:edit',
   'guests', 'edit',
   'Edit Guest Profiles',
   'Update guest contact details, tags and internal notes'),

  -- ── Folio ─────────────────────────────────────────────────────────────────
  ('folio:view',
   'folio', 'view',
   'View Folio',
   'View guest folio charges, payments and outstanding balance'),

  ('folio:post-charge',
   'folio', 'create',
   'Post Charges',
   'Add room charges, F&B, services, adjustments and discounts to a folio'),

  ('folio:void-charge',
   'folio', 'delete',
   'Void Charges',
   'Mark a folio line item as voided with a reason'),

  -- ── Payments ──────────────────────────────────────────────────────────────
  ('payments:view',
   'payments', 'view',
   'View Payments',
   'View payment history, transaction references and receipts'),

  ('payments:process',
   'payments', 'create',
   'Process Payments',
   'Accept cash, JazzCash, Easypaisa and bank transfer payments'),

  ('payments:refund',
   'payments', 'delete',
   'Issue Refunds',
   'Issue full or partial refunds to guests'),

  -- ── Rooms ─────────────────────────────────────────────────────────────────
  ('rooms:view-status',
   'rooms', 'view',
   'View Room Status',
   'View the room grid and current occupancy status'),

  ('rooms:update-status',
   'rooms', 'edit',
   'Update Room Status',
   'Mark rooms as clean, dirty, out of order or blocked'),

  -- ── POS, Housekeeping, Maintenance ──────────────────────────────────────────
  -- Deliberately NOT seeded here. packages/db/src/seed.ts is the sole source
  -- of truth for these three modules — HOUSEKEEPING_*/MAINTENANCE_*/POS_*
  -- (ALL_PERMISSIONS, gates the API routes) and housekeeping:*/maintenance:*/
  -- pos:* (MODULE_PERMISSIONS, gates app menu/button visibility — see
  -- apps/web's usePermissions()). This file used to define its own
  -- pos:view-orders/pos:create-order/pos:manage-menu/housekeeping:view/
  -- maintenance:view/maintenance:resolve here, none of which were ever
  -- checked anywhere in the app — dead rows that also caused the Settings
  -- permissions UI to show doubled Read/Create/Update toggles for these
  -- modules. Fixed by migration 20260706000001_reclassify_dual_purpose_permissions.

  -- ── Reports ───────────────────────────────────────────────────────────────
  ('reports:view',
   'reports', 'view',
   'View Reports',
   'Access occupancy, revenue, channel and staff performance analytics'),

  -- ── Audit ─────────────────────────────────────────────────────────────────
  ('audit:view',
   'audit', 'view',
   'View Audit Log',
   'View the full system audit trail of all staff actions'),

  -- ── Staff & Roles ─────────────────────────────────────────────────────────
  ('staff:manage',
   'staff', 'edit',
   'Manage Staff',
   'Add, edit, deactivate and assign roles to staff accounts'),

  ('staff:manage-roles',
   'staff', 'edit',
   'Manage Roles',
   'Create custom roles and change permission assignments (Phase 2)'),

  -- ── Settings ──────────────────────────────────────────────────────────────
  ('settings:view',
   'settings', 'view',
   'View Settings',
   'View hotel configuration, tax settings and integrations'),

  ('settings:edit',
   'settings', 'edit',
   'Edit Settings',
   'Change hotel configuration, tax rates and integration credentials'),

  -- ── Inventory ─────────────────────────────────────────────────────────────
  ('inventory:view',
   'inventory', 'view',
   'View Inventory',
   'View stock levels, par levels and item history'),

  ('inventory:update',
   'inventory', 'edit',
   'Update Inventory',
   'Receive stock, log consumption and adjust quantities'),

  -- ── Shift Reports ─────────────────────────────────────────────────────────
  ('shift-reports:view',
   'shifts', 'view',
   'View Shift Reports',
   'View cash reconciliation summaries and shift activity'),

  ('shift-reports:close',
   'shifts', 'edit',
   'Close Shifts',
   'Sign off shift reports and reconcile the cash drawer')

ON CONFLICT (key) DO NOTHING;


-- ============================================================================
-- 14. SEED: ROLE → PERMISSION ASSIGNMENTS
-- Wires the system roles to their permission sets.
-- Uses a helper function to keep the INSERT code readable.
-- ============================================================================

CREATE OR REPLACE FUNCTION assign_permissions_to_role(
  p_role_name   TEXT,
  p_perm_keys   TEXT[]
)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_role_id UUID;
  v_perm_key TEXT;
  v_perm_id  UUID;
BEGIN
  -- Find the system role (hotel_id IS NULL)
  SELECT id INTO v_role_id
  FROM   roles
  WHERE  name      = p_role_name
    AND  hotel_id  IS NULL;

  IF v_role_id IS NULL THEN
    RAISE WARNING 'Role % not found — skipping permission assignment', p_role_name;
    RETURN;
  END IF;

  FOREACH v_perm_key IN ARRAY p_perm_keys LOOP
    SELECT id INTO v_perm_id
    FROM   permissions
    WHERE  key = v_perm_key;

    IF v_perm_id IS NULL THEN
      RAISE WARNING 'Permission % not found — skipping', v_perm_key;
      CONTINUE;
    END IF;

    INSERT INTO role_permissions (role_id, permission_id)
    VALUES (v_role_id, v_perm_id)
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END LOOP;
END;
$$;

-- ── OWNER — everything ────────────────────────────────────────────────────────
SELECT assign_permissions_to_role('OWNER', ARRAY[
  'reservations:view', 'reservations:create', 'reservations:edit', 'reservations:cancel',
  'guests:view', 'guests:view-sensitive', 'guests:edit',
  'folio:view', 'folio:post-charge', 'folio:void-charge',
  'payments:view', 'payments:process', 'payments:refund',
  'rooms:view-status', 'rooms:update-status',
  'reports:view',
  'audit:view',
  'staff:manage', 'staff:manage-roles',
  'settings:view', 'settings:edit',
  'inventory:view', 'inventory:update',
  'shift-reports:view', 'shift-reports:close'
]);

-- ── MANAGER — everything except audit log and hotel settings ──────────────────
-- Housekeeping/Maintenance/POS access for this role comes from seed.ts's
-- MODULE_ROLE_PERMISSIONS + ROLE_PERMISSIONS (see note above) — not from here.
SELECT assign_permissions_to_role('MANAGER', ARRAY[
  'reservations:view', 'reservations:create', 'reservations:edit', 'reservations:cancel',
  'guests:view', 'guests:view-sensitive', 'guests:edit',
  'folio:view', 'folio:post-charge', 'folio:void-charge',
  'payments:view', 'payments:process',
  -- no 'payments:refund' — owner approval required
  'rooms:view-status', 'rooms:update-status',
  'reports:view',
  -- no 'audit:view'
  'staff:manage',
  -- no 'staff:manage-roles'
  'settings:view',
  -- no 'settings:edit'
  'inventory:view', 'inventory:update',
  'shift-reports:view', 'shift-reports:close'
]);

-- ── FRONT_DESK — operational access; no refunds, reports or staff management ──
SELECT assign_permissions_to_role('FRONT_DESK', ARRAY[
  'reservations:view', 'reservations:create', 'reservations:edit',
  -- no 'reservations:cancel' — needs manager
  'guests:view', 'guests:view-sensitive', 'guests:edit',
  'folio:view', 'folio:post-charge',
  -- no 'folio:void-charge' — needs manager
  'payments:view', 'payments:process',
  'rooms:view-status', 'rooms:update-status',
  'settings:view',
  'shift-reports:view'
]);

-- ── HOUSEKEEPING — rooms, tasks, maintenance, supplies ────────────────────────
-- Housekeeping/maintenance access for this role comes from seed.ts instead
-- (see note above) — this array only covers what's still defined in this file.
SELECT assign_permissions_to_role('HOUSEKEEPING', ARRAY[
  'rooms:view-status', 'rooms:update-status',
  'inventory:view', 'inventory:update'
  -- no guest data, no financials, no reports
]);

-- ── KITCHEN — orders and kitchen stock only ───────────────────────────────────
-- POS access for this role comes from seed.ts instead (see note above).
SELECT assign_permissions_to_role('KITCHEN', ARRAY[
  'inventory:view', 'inventory:update'
  -- no guest names, no room numbers in detail, no payments
]);

-- ── MAINTENANCE — tickets and asset management ────────────────────────────────
-- Maintenance access for this role comes from seed.ts instead (see note above).
SELECT assign_permissions_to_role('MAINTENANCE', ARRAY[
  'rooms:view-status',
  'inventory:view', 'inventory:update'
]);

-- ── ACCOUNTANT — financial read + refunds + shift close ───────────────────────
SELECT assign_permissions_to_role('ACCOUNTANT', ARRAY[
  'folio:view',
  'payments:view', 'payments:refund',
  'reports:view',
  'inventory:view',
  'settings:view',
  'shift-reports:view', 'shift-reports:close'
]);


-- ============================================================================
-- 15. HOTEL DEFAULTS SEED FUNCTION
-- Called once when a new hotel is created (from the app's onboarding service).
-- Creates default POS categories and tax config so the hotel can start
-- immediately without manual setup.
-- ============================================================================

CREATE OR REPLACE FUNCTION seed_hotel_defaults(p_hotel_id UUID)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  -- Default POS categories
  INSERT INTO pos_categories (hotel_id, name, sort_order)
  VALUES
    (p_hotel_id, 'Breakfast',     1),
    (p_hotel_id, 'Lunch',         2),
    (p_hotel_id, 'Dinner',        3),
    (p_hotel_id, 'Beverages',     4),
    (p_hotel_id, 'Room Service',  5),
    (p_hotel_id, 'Laundry',       6),
    (p_hotel_id, 'Transport',     7),
    (p_hotel_id, 'Activities',    8),
    (p_hotel_id, 'Miscellaneous', 9)
  ON CONFLICT DO NOTHING;

  -- Default GST (adjust rate and type per province during onboarding)
  INSERT INTO tax_configs (hotel_id, tax_type, rate, is_inclusive, applies_to)
  VALUES
    (p_hotel_id, 'GST', 0.16, false, ARRAY['ROOM', 'FOOD', 'BEVERAGE', 'SERVICES'])
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Hotel % seeded with default POS categories and tax config.', p_hotel_id;
END;
$$;


-- ============================================================================
-- 16. PHASE 2 REFERENCE (DO NOT RUN — documentation only)
-- These migrations will be created via `prisma migrate dev` when the time
-- comes. Documented here so the team knows what's coming.
-- ============================================================================

/*
-- Phase 2: Driver and vehicle management
ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS driver_id            UUID,
  ADD COLUMN IF NOT EXISTS vehicle_id           UUID,
  ADD COLUMN IF NOT EXISTS pickup_scheduled_at  TIMESTAMPTZ;

-- Phase 2: Tour operator table
CREATE TABLE IF NOT EXISTS tour_operators (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  contact     TEXT,
  city        TEXT,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Phase 2: WhatsApp briefing log
CREATE TABLE IF NOT EXISTS whatsapp_briefing_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id    UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  sent_at     TIMESTAMPTZ NOT NULL,
  payload     JSONB NOT NULL,
  status      TEXT NOT NULL DEFAULT 'SENT',
  error       TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Phase 3: Travel agent portal
CREATE TABLE IF NOT EXISTS travel_agents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  company      TEXT,
  phone        TEXT,
  email        TEXT,
  city         TEXT,
  is_verified  BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_hotel_contracts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id         UUID REFERENCES travel_agents(id),
  hotel_id         UUID REFERENCES hotels(id),
  commission_rate  DECIMAL(5,4),
  net_rate_plan_id UUID,
  valid_from       DATE,
  valid_to         DATE,
  is_active        BOOLEAN DEFAULT true
);
*/
