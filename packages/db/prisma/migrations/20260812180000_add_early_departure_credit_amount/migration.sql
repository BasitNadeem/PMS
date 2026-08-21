-- Stores the exact management-approved gross credit for partial early-departure
-- reimbursements. Money remains integer paisas, consistent with all folio data.
ALTER TABLE "reservation_stay_changes"
  ADD COLUMN "early_departure_credit_amount" INTEGER NOT NULL DEFAULT 0;
