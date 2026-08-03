-- Corporate Billing / Credit Accounts
--
-- Hand-written: `prisma migrate diff` against this repo emits unrelated
-- destructive drift because expenses, cash_accounts, ledger_entries,
-- whatsapp_briefing_logs, menu_*, qr_order* and subscription_plans are raw-SQL
-- tables managed outside schema.prisma. Only this feature's statements belong
-- here.

-- ── Enums ────────────────────────────────────────────────────────────────────
CREATE TYPE "CompanyType" AS ENUM ('TOUR_AGENCY', 'CORPORATE', 'GOVERNMENT', 'NGO', 'OTHER');
CREATE TYPE "CompanyPaymentTerms" AS ENUM ('IMMEDIATE', 'NET_7', 'NET_15', 'NET_30', 'NET_45', 'NET_60', 'NET_90');
CREATE TYPE "CompanyLedgerEntryType" AS ENUM ('CHARGE', 'PAYMENT', 'ADJUSTMENT', 'WRITE_OFF');
CREATE TYPE "CompanyInvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'VOID');

-- ── companies ────────────────────────────────────────────────────────────────
CREATE TABLE "companies" (
  "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "hotel_id"         UUID NOT NULL,
  "name"             TEXT NOT NULL,
  "type"             "CompanyType" NOT NULL DEFAULT 'TOUR_AGENCY',
  "code"             TEXT,
  "contact_name"     TEXT,
  "contact_phone"    TEXT,
  "contact_email"    TEXT,
  "address"          TEXT,
  "city"             TEXT,
  "ntn"              TEXT,
  "strn"             TEXT,
  "credit_limit"     INTEGER NOT NULL DEFAULT 0,
  "payment_terms"    "CompanyPaymentTerms" NOT NULL DEFAULT 'NET_30',
  "balance"          INTEGER NOT NULL DEFAULT 0,
  "rate_plan_id"     UUID,
  "discount_percent" INTEGER,
  "is_active"        BOOLEAN NOT NULL DEFAULT true,
  "notes"            TEXT,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3) NOT NULL,
  "deleted_at"       TIMESTAMP(3),

  CONSTRAINT "companies_hotel_id_fkey"
    FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "companies_rate_plan_id_fkey"
    FOREIGN KEY ("rate_plan_id") REFERENCES "rate_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "companies_hotel_id_name_key" ON "companies"("hotel_id", "name");
CREATE INDEX "companies_hotel_id_idx"           ON "companies"("hotel_id");
CREATE INDEX "companies_hotel_id_is_active_idx" ON "companies"("hotel_id", "is_active");
CREATE INDEX "companies_hotel_id_type_idx"      ON "companies"("hotel_id", "type");

-- ── company_invoices ─────────────────────────────────────────────────────────
-- Created before company_ledger_entries because entries carry an invoice_id FK.
CREATE TABLE "company_invoices" (
  "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "hotel_id"       UUID NOT NULL,
  "company_id"     UUID NOT NULL,
  "invoice_number" TEXT NOT NULL,
  "status"         "CompanyInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
  "period_start"   DATE NOT NULL,
  "period_end"     DATE NOT NULL,
  "subtotal"       INTEGER NOT NULL DEFAULT 0,
  "tax_amount"     INTEGER NOT NULL DEFAULT 0,
  "total_amount"   INTEGER NOT NULL DEFAULT 0,
  "paid_amount"    INTEGER NOT NULL DEFAULT 0,
  "issued_at"      TIMESTAMP(3),
  "due_date"       TIMESTAMP(3),
  "notes"          TEXT,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"     TIMESTAMP(3) NOT NULL,
  "created_by"     UUID,

  CONSTRAINT "company_invoices_hotel_id_fkey"
    FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "company_invoices_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "company_invoices_invoice_number_key"  ON "company_invoices"("invoice_number");
CREATE INDEX "company_invoices_hotel_id_idx"               ON "company_invoices"("hotel_id");
CREATE INDEX "company_invoices_company_id_period_end_idx"  ON "company_invoices"("company_id", "period_end");
CREATE INDEX "company_invoices_hotel_id_status_idx"        ON "company_invoices"("hotel_id", "status");

-- ── company_ledger_entries ───────────────────────────────────────────────────
CREATE TABLE "company_ledger_entries" (
  "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "hotel_id"       UUID NOT NULL,
  "company_id"     UUID NOT NULL,
  "type"           "CompanyLedgerEntryType" NOT NULL,
  "amount"         INTEGER NOT NULL,
  "description"    TEXT NOT NULL,
  "entry_date"     TIMESTAMP(3) NOT NULL,
  "due_date"       TIMESTAMP(3),
  "settled_amount" INTEGER NOT NULL DEFAULT 0,
  "folio_id"       UUID,
  "reservation_id" UUID,
  "guest_name"     TEXT,
  "room_number"    TEXT,
  "stay_from"      DATE,
  "stay_to"        DATE,
  "payment_method" "PaymentMethod",
  "reference"      TEXT,
  "invoice_id"     UUID,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by"     UUID,

  CONSTRAINT "company_ledger_entries_hotel_id_fkey"
    FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "company_ledger_entries_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "company_ledger_entries_folio_id_fkey"
    FOREIGN KEY ("folio_id") REFERENCES "folios"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "company_ledger_entries_invoice_id_fkey"
    FOREIGN KEY ("invoice_id") REFERENCES "company_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE,

  -- Amounts are stored unsigned; direction comes from `type`. Without this a
  -- negative charge would silently invert the aging buckets.
  CONSTRAINT "company_ledger_entries_amount_positive" CHECK ("amount" >= 0),
  CONSTRAINT "company_ledger_entries_settled_within_amount"
    CHECK ("settled_amount" >= 0 AND "settled_amount" <= "amount")
);

CREATE INDEX "company_ledger_entries_hotel_id_idx"          ON "company_ledger_entries"("hotel_id");
CREATE INDEX "company_ledger_entries_company_entry_date_idx" ON "company_ledger_entries"("company_id", "entry_date");
CREATE INDEX "company_ledger_entries_company_open_idx"       ON "company_ledger_entries"("company_id", "type", "settled_amount");
CREATE INDEX "company_ledger_entries_hotel_id_due_date_idx"  ON "company_ledger_entries"("hotel_id", "due_date");
CREATE INDEX "company_ledger_entries_invoice_id_idx"         ON "company_ledger_entries"("invoice_id");

-- One folio can only ever be transferred to the ledger once. This is the
-- guard that stops a retried checkout from double-charging the company.
CREATE UNIQUE INDEX "company_ledger_entries_folio_id_key"
  ON "company_ledger_entries"("folio_id") WHERE "folio_id" IS NOT NULL;

-- ── Link bookings to companies ───────────────────────────────────────────────
ALTER TABLE "reservations"   ADD COLUMN "company_id" UUID;
ALTER TABLE "reservations"   ADD COLUMN "bill_to_company" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "group_bookings" ADD COLUMN "company_id" UUID;

ALTER TABLE "reservations"
  ADD CONSTRAINT "reservations_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "group_bookings"
  ADD CONSTRAINT "group_bookings_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "reservations_hotel_id_company_id_idx"   ON "reservations"("hotel_id", "company_id");
CREATE INDEX "group_bookings_hotel_id_company_id_idx" ON "group_bookings"("hotel_id", "company_id");
