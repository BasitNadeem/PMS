-- AlterTable
ALTER TABLE "hotels" ADD COLUMN IF NOT EXISTS "current_business_date" DATE;

-- CreateTable
CREATE TABLE "night_audit_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotelId" UUID NOT NULL,
    "businessDate" DATE NOT NULL,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "runBy" UUID NOT NULL,
    "occupancyRate" DECIMAL(65,30) NOT NULL,
    "roomRevenue" INTEGER NOT NULL,
    "posRevenue" INTEGER NOT NULL,
    "totalCollected" INTEGER NOT NULL,
    "totalOutstanding" INTEGER NOT NULL,
    "noShowsFlagged" INTEGER NOT NULL DEFAULT 0,
    "openBalanceCount" INTEGER NOT NULL DEFAULT 0,
    "snapshot" JSONB NOT NULL,

    CONSTRAINT "night_audit_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "night_audit_records_hotelId_businessDate_idx" ON "night_audit_records"("hotelId", "businessDate");

-- CreateIndex
CREATE UNIQUE INDEX "night_audit_records_hotelId_businessDate_key" ON "night_audit_records"("hotelId", "businessDate");

-- AddForeignKey
ALTER TABLE "night_audit_records" ADD CONSTRAINT "night_audit_records_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
