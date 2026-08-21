-- Make the existing confirmation number the single human-facing Res ID while
-- preserving every old reference for support searches and historic emails.
ALTER TABLE "reservations"
  ADD COLUMN "legacy_confirmation_number" TEXT;

CREATE UNIQUE INDEX "reservations_legacy_confirmation_number_key"
  ON "reservations"("legacy_confirmation_number");

-- Keep old references before replacing their visible identity. Existing RES
-- references (if any) are deliberately left untouched.
UPDATE "reservations"
SET "legacy_confirmation_number" = "confirmation_number"
WHERE "confirmation_number" NOT LIKE 'RES-%';

DO $$
DECLARE
  next_number BIGINT;
  reservation_row RECORD;
BEGIN
  SELECT COALESCE(MAX((SUBSTRING("confirmation_number" FROM 5))::BIGINT), 0)
    INTO next_number
  FROM "reservations"
  WHERE "confirmation_number" ~ '^RES-[0-9]+$';

  FOR reservation_row IN
    SELECT "id"
    FROM "reservations"
    WHERE "confirmation_number" NOT LIKE 'RES-%'
    ORDER BY "created_at", "id"
  LOOP
    next_number := next_number + 1;
    UPDATE "reservations"
    SET "confirmation_number" = 'RES-' || LPAD(next_number::TEXT, 6, '0')
    WHERE "id" = reservation_row."id";
  END LOOP;

  PERFORM SETVAL('seq_reservation', GREATEST(next_number, 1), next_number > 0);
END $$;

CREATE OR REPLACE FUNCTION next_confirmation_number()
RETURNS TEXT LANGUAGE plpgsql AS $$
BEGIN
  RETURN 'RES-' || LPAD(NEXTVAL('seq_reservation')::TEXT, 6, '0');
END;
$$;
