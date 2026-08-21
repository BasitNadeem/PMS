-- Records whether an early departure retained the contracted stay charges or
-- credited unused nights. Nullable for room moves and historical changes.
ALTER TABLE "reservation_stay_changes"
  ADD COLUMN "early_departure_treatment" TEXT;
