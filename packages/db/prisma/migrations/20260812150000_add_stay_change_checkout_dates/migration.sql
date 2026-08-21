-- Preserve the before/after departure dates for checked-in extensions and
-- early departures. Nullable keeps existing room-move history valid.
ALTER TABLE "reservation_stay_changes"
  ADD COLUMN "previous_check_out" DATE,
  ADD COLUMN "new_check_out" DATE;
