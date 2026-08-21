-- Postal / ZIP code on hotels.
--
-- Channex refuses to connect a property to any OTA until email, phone, address,
-- city, country, state, zip, latitude and longitude are all present. Every one
-- of those already had a column except this: zip_code existed nowhere — not on
-- hotels, not as a settings JSON key, not in updateSettingsSchema. Without it,
-- provisioning correctly refuses for every hotel, forever.
--
-- Nullable: existing hotels have no value and must not be blocked from saving
-- unrelated settings. Channex validation reports it as missing until filled in.

-- AlterTable
ALTER TABLE "hotels"
    ADD COLUMN "zip_code" TEXT;
