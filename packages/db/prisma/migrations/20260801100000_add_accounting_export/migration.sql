-- Accounting export: chart-of-accounts mapping and generated-file history.
--
-- Hand-written for the same reason as the previous migration: `prisma migrate
-- diff` against this repo's history also emits unrelated drift, including
-- `DROP TABLE cash_accounts` (see the warning at the top of schema.prisma —
-- expenses, cash_accounts and ledger_entries are managed outside the schema).
-- Only the statements for this feature are included here.

-- CreateTable
CREATE TABLE "accounting_accounts" (
    "id"           UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotel_id"     UUID NOT NULL,
    -- FOLIO_ITEM_TYPE | TAX_TYPE | PAYMENT_METHOD | EXPENSE_CATEGORY | SYSTEM
    "scope"        TEXT NOT NULL,
    "key"          TEXT NOT NULL,
    "account_code" TEXT NOT NULL,
    "account_name" TEXT NOT NULL,
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounting_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounting_accounts_hotel_id_scope_key_key" ON "accounting_accounts"("hotel_id", "scope", "key");

-- CreateIndex
CREATE INDEX "accounting_accounts_hotel_id_idx" ON "accounting_accounts"("hotel_id");

-- AddForeignKey
ALTER TABLE "accounting_accounts" ADD CONSTRAINT "accounting_accounts_hotel_id_fkey"
  FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "accounting_exports" (
    "id"              UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotel_id"        UUID NOT NULL,
    "period_start"    DATE NOT NULL,
    "period_end"      DATE NOT NULL,
    "format"          TEXT NOT NULL,
    "basis"           TEXT NOT NULL,
    "granularity"     TEXT NOT NULL,
    "line_count"      INTEGER NOT NULL,
    -- Minor units. Kept separate so an unbalanced batch is visible in history.
    "total_debit"     INTEGER NOT NULL,
    "total_credit"    INTEGER NOT NULL,
    "content_hash"    TEXT NOT NULL,
    "generated_by_id" UUID,
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounting_exports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "accounting_exports_hotel_id_period_start_idx" ON "accounting_exports"("hotel_id", "period_start");

-- CreateIndex
CREATE INDEX "accounting_exports_hotel_id_created_at_idx" ON "accounting_exports"("hotel_id", "created_at");

-- AddForeignKey
ALTER TABLE "accounting_exports" ADD CONSTRAINT "accounting_exports_hotel_id_fkey"
  FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
