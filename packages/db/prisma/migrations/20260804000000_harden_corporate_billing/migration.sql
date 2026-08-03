-- Harden company credit, invoicing and city-ledger integrity.
-- All monetary values remain integer paisas; BIGINT removes the int4 ceiling.

ALTER TYPE "CompanyLedgerEntryType" ADD VALUE IF NOT EXISTS 'CREDIT_REFUND';

ALTER TABLE companies
  ALTER COLUMN credit_limit TYPE BIGINT USING credit_limit::bigint,
  ALTER COLUMN balance      TYPE BIGINT USING balance::bigint;

ALTER TABLE company_ledger_entries
  ALTER COLUMN amount         TYPE BIGINT USING amount::bigint,
  ALTER COLUMN settled_amount TYPE BIGINT USING settled_amount::bigint,
  ADD COLUMN source_key TEXT,
  ADD COLUMN reversed_at TIMESTAMP(3),
  ADD COLUMN reversed_by UUID,
  ADD COLUMN reversal_reason TEXT;

ALTER TABLE company_invoices
  ALTER COLUMN subtotal     TYPE BIGINT USING subtotal::bigint,
  ALTER COLUMN tax_amount   TYPE BIGINT USING tax_amount::bigint,
  ALTER COLUMN total_amount TYPE BIGINT USING total_amount::bigint,
  ALTER COLUMN paid_amount  TYPE BIGINT USING paid_amount::bigint;

-- Partial transfers are legitimate. Retry protection now comes from source_key
-- rather than forbidding every later movement for the same folio.
DROP INDEX IF EXISTS company_ledger_entries_folio_id_key;
CREATE INDEX IF NOT EXISTS company_ledger_entries_folio_id_idx
  ON company_ledger_entries(folio_id) WHERE folio_id IS NOT NULL;
CREATE UNIQUE INDEX company_ledger_entries_hotel_id_source_key_key
  ON company_ledger_entries(hotel_id, source_key) WHERE source_key IS NOT NULL;

-- Display invoice numbers are scoped to the hotel, not globally across InnFlo.
DROP INDEX IF EXISTS company_invoices_invoice_number_key;
CREATE UNIQUE INDEX company_invoices_hotel_id_invoice_number_key
  ON company_invoices(hotel_id, invoice_number);

ALTER TABLE company_ledger_entries
  DROP CONSTRAINT IF EXISTS company_ledger_entries_amount_positive;
ALTER TABLE company_ledger_entries
  ADD CONSTRAINT company_ledger_entries_amount_positive CHECK (amount > 0);

ALTER TABLE company_ledger_entries
  DROP CONSTRAINT IF EXISTS company_ledger_entries_reversed_by_fkey;
ALTER TABLE company_ledger_entries
  ADD CONSTRAINT company_ledger_entries_reversed_by_fkey
  FOREIGN KEY (reversed_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- Company receipts/refunds are automatic cash movements too.
DROP INDEX IF EXISTS ledger_entries_auto_source_direction_key;
CREATE UNIQUE INDEX ledger_entries_auto_source_direction_key
  ON ledger_entries(hotel_id, source_type, source_id, entry_type)
  WHERE source_id IS NOT NULL
    AND source_type IN (
      'FOLIO_PAYMENT', 'PAYMENT_REFUND', 'POS_SALE', 'QR_ORDER_SALE',
      'EXPENSE', 'COMPANY_PAYMENT', 'COMPANY_CREDIT_REFUND'
    );
