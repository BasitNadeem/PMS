CREATE TABLE IF NOT EXISTS cash_accounts (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id     UUID         NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  name         VARCHAR(100) NOT NULL,
  account_type VARCHAR(50)  NOT NULL,
  balance      INTEGER      NOT NULL DEFAULT 0,
  is_active    BOOLEAN      NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id       UUID         NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  account_id     UUID         NOT NULL REFERENCES cash_accounts(id),
  entry_type     VARCHAR(20)  NOT NULL,
  amount         INTEGER      NOT NULL,
  balance_after  INTEGER      NOT NULL,
  source_type    VARCHAR(50)  NOT NULL,
  source_id      VARCHAR(255),
  description    TEXT         NOT NULL,
  payment_method VARCHAR(50),
  recorded_by_id UUID         NOT NULL REFERENCES users(id),
  entry_date     DATE         NOT NULL DEFAULT CURRENT_DATE,
  notes          TEXT,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cash_accounts_hotel_id_idx      ON cash_accounts(hotel_id);
CREATE INDEX IF NOT EXISTS ledger_entries_hotel_id_idx     ON ledger_entries(hotel_id);
CREATE INDEX IF NOT EXISTS ledger_entries_account_id_idx   ON ledger_entries(account_id);
CREATE INDEX IF NOT EXISTS ledger_entries_hotel_date_idx   ON ledger_entries(hotel_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS ledger_entries_source_idx       ON ledger_entries(source_type, source_id);

GRANT ALL ON cash_accounts   TO hotel_pms_app;
GRANT ALL ON ledger_entries  TO hotel_pms_app;
