-- Harden the raw-SQL Balance Book without moving it into Prisma management.
-- Money remains integer paisas; BIGINT removes the ~PKR 21.47m account ceiling.

ALTER TABLE cash_accounts
  ALTER COLUMN balance TYPE BIGINT USING balance::bigint;

ALTER TABLE ledger_entries
  ALTER COLUMN amount        TYPE BIGINT USING amount::bigint,
  ALTER COLUMN balance_after TYPE BIGINT USING balance_after::bigint;

ALTER TABLE ledger_entries
  ADD COLUMN IF NOT EXISTS reversal_of_entry_id UUID,
  ADD COLUMN IF NOT EXISTS transfer_group_id UUID;

ALTER TABLE ledger_entries
  DROP CONSTRAINT IF EXISTS ledger_entries_reversal_of_entry_id_fkey;
ALTER TABLE ledger_entries
  ADD CONSTRAINT ledger_entries_reversal_of_entry_id_fkey
  FOREIGN KEY (reversal_of_entry_id) REFERENCES ledger_entries(id) ON DELETE RESTRICT;

ALTER TABLE ledger_entries
  DROP CONSTRAINT IF EXISTS ledger_entries_amount_positive;
ALTER TABLE ledger_entries
  ADD CONSTRAINT ledger_entries_amount_positive CHECK (amount > 0);

ALTER TABLE ledger_entries
  DROP CONSTRAINT IF EXISTS ledger_entries_entry_type_valid;
ALTER TABLE ledger_entries
  ADD CONSTRAINT ledger_entries_entry_type_valid
  CHECK (entry_type IN ('INCOMING', 'OUTGOING'));

-- System accounts are named deterministically. This also makes concurrent
-- get-or-create calls safe while still allowing several differently named bank accounts.
WITH ranked AS (
  SELECT id,
         first_value(id) OVER (PARTITION BY hotel_id, lower(name) ORDER BY created_at, id) AS keeper_id,
         row_number() OVER (PARTITION BY hotel_id, lower(name) ORDER BY created_at, id) AS position
  FROM cash_accounts
)
UPDATE ledger_entries le
SET account_id = ranked.keeper_id
FROM ranked
WHERE ranked.position > 1 AND le.account_id = ranked.id;

WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY hotel_id, lower(name) ORDER BY created_at, id) AS position
  FROM cash_accounts
)
DELETE FROM cash_accounts ca USING ranked
WHERE ca.id = ranked.id AND ranked.position > 1;

CREATE UNIQUE INDEX IF NOT EXISTS cash_accounts_hotel_name_key
  ON cash_accounts(hotel_id, lower(name));

-- One automatic source movement in a direction may only be posted once.
-- Expense deletion deliberately uses the same source id in the opposite direction.
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY hotel_id, source_type, source_id, entry_type
           ORDER BY created_at, id
         ) AS position
  FROM ledger_entries
  WHERE source_id IS NOT NULL
    AND source_type IN ('FOLIO_PAYMENT', 'PAYMENT_REFUND', 'POS_SALE', 'QR_ORDER_SALE', 'EXPENSE')
)
DELETE FROM ledger_entries le USING ranked
WHERE le.id = ranked.id AND ranked.position > 1;

CREATE UNIQUE INDEX IF NOT EXISTS ledger_entries_auto_source_direction_key
  ON ledger_entries(hotel_id, source_type, source_id, entry_type)
  WHERE source_id IS NOT NULL
    AND source_type IN ('FOLIO_PAYMENT', 'PAYMENT_REFUND', 'POS_SALE', 'QR_ORDER_SALE', 'EXPENSE');

CREATE UNIQUE INDEX IF NOT EXISTS ledger_entries_reversal_key
  ON ledger_entries(reversal_of_entry_id)
  WHERE reversal_of_entry_id IS NOT NULL;

WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY hotel_id, account_id ORDER BY created_at, id) AS position
  FROM ledger_entries WHERE source_type = 'OPENING_BALANCE'
)
DELETE FROM ledger_entries le USING ranked
WHERE le.id = ranked.id AND ranked.position > 1;

CREATE UNIQUE INDEX IF NOT EXISTS ledger_entries_opening_balance_account_key
  ON ledger_entries(hotel_id, account_id)
  WHERE source_type = 'OPENING_BALANCE';

CREATE INDEX IF NOT EXISTS ledger_entries_transfer_group_idx
  ON ledger_entries(hotel_id, transfer_group_id)
  WHERE transfer_group_id IS NOT NULL;

-- Rebuild cached balances from the immutable movements so existing drift is repaired.
WITH running AS (
  SELECT id,
         SUM(CASE WHEN entry_type = 'INCOMING' THEN amount ELSE -amount END)
           OVER (PARTITION BY account_id ORDER BY entry_date, created_at, id) AS balance
  FROM ledger_entries
)
UPDATE ledger_entries le
SET balance_after = running.balance
FROM running
WHERE le.id = running.id;

UPDATE cash_accounts ca
SET balance = COALESCE((
      SELECT SUM(CASE WHEN le.entry_type = 'INCOMING' THEN le.amount ELSE -le.amount END)
      FROM ledger_entries le
      WHERE le.account_id = ca.id AND le.hotel_id = ca.hotel_id
    ), 0),
    updated_at = now();
