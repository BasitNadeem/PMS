-- Item-level Guest / Bill to company (BTC) responsibility.
-- Historical items default to GUEST; existing company-ledger transfers remain
-- authoritative coverage and are accounted for by the balance engine.

CREATE TYPE "FolioPayerType" AS ENUM ('GUEST', 'COMPANY');

ALTER TABLE "folios"
  ADD COLUMN "guest_responsibility_total" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "company_responsibility_total" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "guest_balance_due" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "company_balance_due" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "folio_items"
  ADD COLUMN "payer_type" "FolioPayerType" NOT NULL DEFAULT 'GUEST',
  ADD COLUMN "payer_company_id" UUID,
  ADD COLUMN "allocated_at" TIMESTAMP(3),
  ADD COLUMN "allocated_by" UUID;

ALTER TABLE "folio_items"
  ADD CONSTRAINT "folio_items_payer_company_id_fkey"
  FOREIGN KEY ("payer_company_id") REFERENCES "companies"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "folio_items"
  ADD CONSTRAINT "folio_items_payer_assignment_check"
  CHECK (
    ("payer_type" = 'GUEST' AND "payer_company_id" IS NULL)
    OR
    ("payer_type" = 'COMPANY' AND "payer_company_id" IS NOT NULL)
  );

CREATE INDEX "folio_items_hotel_id_payer_type_idx"
  ON "folio_items"("hotel_id", "payer_type");
CREATE INDEX "folio_items_payer_company_id_idx"
  ON "folio_items"("payer_company_id");

CREATE TABLE "folio_item_payer_changes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "hotel_id" UUID NOT NULL,
  "folio_item_id" UUID NOT NULL,
  "previous_payer_type" "FolioPayerType" NOT NULL,
  "previous_payer_company_id" UUID,
  "new_payer_type" "FolioPayerType" NOT NULL,
  "new_payer_company_id" UUID,
  "reason" TEXT NOT NULL,
  "changed_by" UUID NOT NULL,
  "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "folio_item_payer_changes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "folio_item_payer_changes_previous_assignment_check" CHECK (
    ("previous_payer_type" = 'GUEST' AND "previous_payer_company_id" IS NULL)
    OR
    ("previous_payer_type" = 'COMPANY' AND "previous_payer_company_id" IS NOT NULL)
  ),
  CONSTRAINT "folio_item_payer_changes_new_assignment_check" CHECK (
    ("new_payer_type" = 'GUEST' AND "new_payer_company_id" IS NULL)
    OR
    ("new_payer_type" = 'COMPANY' AND "new_payer_company_id" IS NOT NULL)
  )
);

ALTER TABLE "folio_item_payer_changes"
  ADD CONSTRAINT "folio_item_payer_changes_hotel_id_fkey"
  FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "folio_item_payer_changes"
  ADD CONSTRAINT "folio_item_payer_changes_folio_item_id_fkey"
  FOREIGN KEY ("folio_item_id") REFERENCES "folio_items"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "folio_item_payer_changes"
  ADD CONSTRAINT "folio_item_payer_changes_previous_payer_company_id_fkey"
  FOREIGN KEY ("previous_payer_company_id") REFERENCES "companies"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "folio_item_payer_changes"
  ADD CONSTRAINT "folio_item_payer_changes_new_payer_company_id_fkey"
  FOREIGN KEY ("new_payer_company_id") REFERENCES "companies"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "folio_item_payer_changes_hotel_id_changed_at_idx"
  ON "folio_item_payer_changes"("hotel_id", "changed_at");
CREATE INDEX "folio_item_payer_changes_folio_item_id_changed_at_idx"
  ON "folio_item_payer_changes"("folio_item_id", "changed_at");
CREATE INDEX "folio_item_payer_changes_previous_payer_company_id_idx"
  ON "folio_item_payer_changes"("previous_payer_company_id");
CREATE INDEX "folio_item_payer_changes_new_payer_company_id_idx"
  ON "folio_item_payer_changes"("new_payer_company_id");

-- Backfill the denormalised Guest totals for existing folios. Existing BTC
-- ledger coverage is subtracted so a transferred folio does not re-open.
WITH item_totals AS (
  SELECT
    f.id AS folio_id,
    COALESCE(SUM(CASE
      WHEN fi.is_voided = FALSE AND fi.type = 'DISCOUNT' THEN -fi.amount
      WHEN fi.is_voided = FALSE THEN fi.amount
      ELSE 0
    END), 0)::INTEGER AS responsibility
  FROM folios f
  LEFT JOIN folio_items fi ON fi.folio_id = f.id
  GROUP BY f.id
),
company_coverage AS (
  SELECT
    folio_id,
    COALESCE(SUM(CASE WHEN reversed_at IS NULL AND type = 'CHARGE' THEN amount ELSE 0 END), 0)::INTEGER AS covered
  FROM company_ledger_entries
  WHERE folio_id IS NOT NULL
  GROUP BY folio_id
)
UPDATE folios f
SET
  guest_responsibility_total = GREATEST(0, it.responsibility),
  company_responsibility_total = 0,
  guest_balance_due = GREATEST(0, it.responsibility - f.payments_total - COALESCE(cc.covered, 0)),
  company_balance_due = 0
FROM item_totals it
LEFT JOIN company_coverage cc ON cc.folio_id = it.folio_id
WHERE f.id = it.folio_id;
