-- AlterTable
-- Backfills hotels.description / hotels.amenities, which schema.prisma has
-- defined since the Booking Engine work but no migration file ever created —
-- these columns only existed on dev DBs via an out-of-band change.
ALTER TABLE "hotels" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "hotels" ADD COLUMN IF NOT EXISTS "amenities" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
