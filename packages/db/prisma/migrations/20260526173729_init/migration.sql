/*
  Warnings:

  - You are about to drop the column `channelType` on the `channel_configs` table. All the data in the column will be lost.
  - You are about to drop the column `documentType` on the `guest_blacklist` table. All the data in the column will be lost.
  - You are about to drop the column `documentType` on the `guests` table. All the data in the column will be lost.
  - You are about to drop the column `propertyType` on the `hotels` table. All the data in the column will be lost.
  - You are about to drop the column `guestType` on the `reservations` table. All the data in the column will be lost.
  - You are about to drop the column `typeName` on the `room_types` table. All the data in the column will be lost.
  - You are about to drop the column `taxType` on the `tax_configs` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[hotel_id,channel_type]` on the table `channel_configs` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `channel_type` to the `channel_configs` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tax_type` to the `tax_configs` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "channel_configs_hotel_id_channelType_key";

-- AlterTable
ALTER TABLE "channel_configs" DROP COLUMN "channelType",
ADD COLUMN     "channel_type" "ChannelType" NOT NULL;

-- AlterTable
ALTER TABLE "guest_blacklist" DROP COLUMN "documentType",
ADD COLUMN     "document_type" "DocumentType";

-- AlterTable
ALTER TABLE "guests" DROP COLUMN "documentType",
ADD COLUMN     "document_type" "DocumentType" NOT NULL DEFAULT 'CNIC';

-- AlterTable
ALTER TABLE "hotels" DROP COLUMN "propertyType",
ADD COLUMN     "property_type" "PropertyType" NOT NULL DEFAULT 'HOTEL';

-- AlterTable
ALTER TABLE "reservations" DROP COLUMN "guestType",
ADD COLUMN     "guest_type" "GuestType" NOT NULL DEFAULT 'INDIVIDUAL';

-- AlterTable
ALTER TABLE "room_types" DROP COLUMN "typeName",
ADD COLUMN     "type_name" "RoomTypeName" NOT NULL DEFAULT 'DOUBLE';

-- AlterTable
ALTER TABLE "tax_configs" DROP COLUMN "taxType",
ADD COLUMN     "tax_type" "TaxType" NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "channel_configs_hotel_id_channel_type_key" ON "channel_configs"("hotel_id", "channel_type");
