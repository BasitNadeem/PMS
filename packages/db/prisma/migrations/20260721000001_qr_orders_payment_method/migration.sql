-- room_number is no longer always collected on the guest order form — pickup/dine-in
-- orders paid on the spot with no matched reservation can now be placed without one
-- (see the payment-preference-visibility fix). The column must stop rejecting NULLs
-- to match.
ALTER TABLE qr_orders ALTER COLUMN room_number DROP NOT NULL;

-- Payment method actually received for "pay now" orders, captured by staff when
-- marking the order delivered. "Charge to room" orders never populate this — they
-- settle through the folio instead. Options match DirectPaymentModal's POS
-- direct-payment set so a QR ledger entry routes to the same cash-book account a
-- POS sale with the same method would.
ALTER TABLE qr_orders ADD COLUMN IF NOT EXISTS payment_method TEXT
  CHECK (payment_method IN ('CASH', 'JAZZCASH', 'EASYPAISA', 'CREDIT_CARD', 'DEBIT_CARD'));
