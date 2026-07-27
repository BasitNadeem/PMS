ALTER TABLE "reservations"
  ADD COLUMN "subtotal_amount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "tax_amount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "tax_inclusive" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "tax_breakdown" JSONB;

UPDATE "reservations"
SET "subtotal_amount" = "total_amount"
WHERE "subtotal_amount" = 0;

ALTER TABLE "qr_orders"
  ADD COLUMN IF NOT EXISTS "subtotal_amount" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "tax_amount" BIGINT NOT NULL DEFAULT 0;

UPDATE "qr_orders"
SET "subtotal_amount" = "total_amount"
WHERE "subtotal_amount" = 0;
