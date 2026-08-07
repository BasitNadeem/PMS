-- CreateEnum
CREATE TYPE "UpsellPriceType" AS ENUM ('FLAT', 'PER_NIGHT', 'PER_GUEST');

-- CreateTable
CREATE TABLE "upsell_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotel_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "FolioItemType" NOT NULL,
    "price_type" "UpsellPriceType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "image_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "upsell_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservation_upsells" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "reservation_id" UUID NOT NULL,
    "upsell_item_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "category" "FolioItemType" NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_amount" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "posted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reservation_upsells_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "upsell_items_hotel_id_idx" ON "upsell_items"("hotel_id");

-- CreateIndex
CREATE INDEX "upsell_items_hotel_id_is_active_idx" ON "upsell_items"("hotel_id", "is_active");

-- CreateIndex
CREATE INDEX "reservation_upsells_reservation_id_idx" ON "reservation_upsells"("reservation_id");

-- AddForeignKey
ALTER TABLE "upsell_items" ADD CONSTRAINT "upsell_items_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_upsells" ADD CONSTRAINT "reservation_upsells_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_upsells" ADD CONSTRAINT "reservation_upsells_upsell_item_id_fkey" FOREIGN KEY ("upsell_item_id") REFERENCES "upsell_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Tenant isolation. upsell_items carries hotel_id directly; reservation_upsells
-- is isolated through its parent reservation, matching reservation_rooms.
SELECT enable_hotel_rls('upsell_items');

ALTER TABLE reservation_upsells ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservation_upsells FORCE   ROW LEVEL SECURITY;
DROP POLICY IF EXISTS open_access ON reservation_upsells;
CREATE POLICY open_access ON reservation_upsells USING (true);
