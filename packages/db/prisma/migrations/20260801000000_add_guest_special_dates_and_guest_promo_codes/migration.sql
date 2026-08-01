-- Guest special dates (birthday / anniversary) and per-guest promo codes.
--
-- Written by hand rather than generated: `prisma migrate diff` against this
-- repo's migration history also emits a large amount of pre-existing drift
-- (dropping and recreating foreign keys across cash_accounts, expenses,
-- front_desk_notes, ledger_entries and menu_*, plus `DROP TABLE cash_accounts`
-- and dropping the guests search vector column). None of that belongs to this
-- change, so only the statements for this feature are included here.

-- CreateEnum
CREATE TYPE "SpecialDateKind" AS ENUM ('BIRTHDAY', 'ANNIVERSARY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "PromoIssueReason" AS ENUM ('BIRTHDAY', 'ANNIVERSARY', 'VIP_REWARD', 'WIN_BACK', 'MANUAL');

-- AlterTable: consent and the "asked, but declined" marker.
ALTER TABLE "guests"
  ADD COLUMN "special_dates_declined_at" TIMESTAMP(3),
  ADD COLUMN "marketing_opt_in"          BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "marketing_opt_in_at"       TIMESTAMP(3);

-- CreateTable
CREATE TABLE "guest_special_dates" (
    "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotel_id"   UUID NOT NULL,
    "guest_id"   UUID NOT NULL,
    "kind"       "SpecialDateKind" NOT NULL DEFAULT 'BIRTHDAY',
    "label"      TEXT,
    "month"      INTEGER NOT NULL,
    "day"        INTEGER NOT NULL,
    -- Nullable: many guests share the day and month but not the year.
    "year"       INTEGER,
    "source"     TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guest_special_dates_pkey" PRIMARY KEY ("id")
);

-- Guard against a nonsensical calendar day surviving a bad API caller.
ALTER TABLE "guest_special_dates"
  ADD CONSTRAINT "guest_special_dates_month_check" CHECK ("month" BETWEEN 1 AND 12),
  ADD CONSTRAINT "guest_special_dates_day_check"   CHECK ("day"   BETWEEN 1 AND 31);

-- CreateIndex
CREATE INDEX "guest_special_dates_hotel_id_month_day_idx" ON "guest_special_dates"("hotel_id", "month", "day");

-- CreateIndex
CREATE INDEX "guest_special_dates_guest_id_idx" ON "guest_special_dates"("guest_id");

-- CreateIndex
CREATE UNIQUE INDEX "guest_special_dates_guest_id_kind_month_day_key" ON "guest_special_dates"("guest_id", "kind", "month", "day");

-- AddForeignKey
ALTER TABLE "guest_special_dates" ADD CONSTRAINT "guest_special_dates_hotel_id_fkey"
  FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_special_dates" ADD CONSTRAINT "guest_special_dates_guest_id_fkey"
  FOREIGN KEY ("guest_id") REFERENCES "guests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: per-guest issuance on the existing promo/corporate code table.
-- Every column is nullable or defaulted, so the shared codes already in this
-- table keep working unchanged (guest_id NULL, max_uses NULL = unlimited).
ALTER TABLE "rate_plan_codes"
  ADD COLUMN "guest_id"     UUID,
  ADD COLUMN "issue_reason" "PromoIssueReason",
  ADD COLUMN "max_uses"     INTEGER,
  ADD COLUMN "used_count"   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "last_used_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "rate_plan_codes_guest_id_idx" ON "rate_plan_codes"("guest_id");

-- AddForeignKey
ALTER TABLE "rate_plan_codes" ADD CONSTRAINT "rate_plan_codes_guest_id_fkey"
  FOREIGN KEY ("guest_id") REFERENCES "guests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
