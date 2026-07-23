ALTER TABLE "hotels"
ADD COLUMN "cancellation_policy" TEXT,
ADD COLUMN "booking_payment_terms" TEXT;

ALTER TABLE "reservations"
ADD COLUMN "cancellation_policy_snapshot" TEXT,
ADD COLUMN "booking_payment_terms_snapshot" TEXT,
ADD COLUMN "terms_accepted_at" TIMESTAMP(3);
