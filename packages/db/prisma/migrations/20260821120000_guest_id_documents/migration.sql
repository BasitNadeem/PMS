-- Guest identity document capture.
--
-- Hand-written, not generated. `prisma migrate diff` cannot be used in this
-- repo: eight tables (expenses, ledger_entries, cash_accounts, menu_categories,
-- menu_items, qr_orders, qr_order_items, whatsapp_briefing_logs) are managed
-- outside Prisma and accessed by raw SQL, so a generated diff always proposes
-- dropping them. See the header comment in services/ExpenseService.ts.
--
-- RLS is NOT applied here. The convention for this repo is a single line in
-- rls_and_triggers.sql (`SELECT enable_hotel_rls('guest_documents');`), applied
-- by `pnpm apply:rls` after migrating. Calling the helper from inside a
-- migration is what makes `prisma migrate dev` fail against a shadow database.

-- CreateEnum
CREATE TYPE "DocumentSide" AS ENUM ('FRONT', 'BACK');

-- AlterTable: per-stay record that ID was checked at this check-in
ALTER TABLE "reservations"
  ADD COLUMN "id_verified_at"     TIMESTAMP(3),
  ADD COLUMN "id_verified_by"     UUID,
  ADD COLUMN "id_override_reason" TEXT;

-- CreateTable
CREATE TABLE "guest_documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotel_id" UUID NOT NULL,
    "guest_id" UUID NOT NULL,
    "reservation_id" UUID,
    "type" "DocumentType" NOT NULL DEFAULT 'CNIC',
    "side" "DocumentSide" NOT NULL,
    "storage_key" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'cloudinary',
    "mime_type" TEXT NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "captured_by" UUID,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guest_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "guest_documents_hotel_id_guest_id_idx" ON "guest_documents"("hotel_id", "guest_id");
CREATE INDEX "guest_documents_hotel_id_reservation_id_idx" ON "guest_documents"("hotel_id", "reservation_id");
CREATE INDEX "guest_documents_hotel_id_deleted_at_idx" ON "guest_documents"("hotel_id", "deleted_at");

-- AddForeignKey
ALTER TABLE "guest_documents" ADD CONSTRAINT "guest_documents_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "guest_documents" ADD CONSTRAINT "guest_documents_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "guests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "guest_documents" ADD CONSTRAINT "guest_documents_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
