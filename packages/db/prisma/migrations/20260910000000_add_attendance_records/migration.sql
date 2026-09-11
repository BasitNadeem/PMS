-- Login-linked attendance for hotel staff. This is intentionally a compact
-- daily sheet: one row per hotel, user and Pakistan calendar date.
CREATE TABLE IF NOT EXISTS attendance_records (
  id               UUID NOT NULL DEFAULT gen_random_uuid(),
  hotel_id         UUID NOT NULL,
  user_id          UUID NOT NULL,
  attendance_date  DATE NOT NULL,
  first_login_at   TIMESTAMPTZ,
  last_login_at    TIMESTAMPTZ,
  login_count      INTEGER NOT NULL DEFAULT 0,
  source           VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
  status           VARCHAR(20) NOT NULL DEFAULT 'PRESENT',
  role             VARCHAR(40) NOT NULL DEFAULT 'STAFF',
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT attendance_records_pkey PRIMARY KEY (id),
  CONSTRAINT attendance_records_hotel_id_fkey FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE,
  CONSTRAINT attendance_records_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT attendance_records_hotel_user_date_key UNIQUE (hotel_id, user_id, attendance_date),
  CONSTRAINT attendance_records_source_check CHECK (source IN ('APP_LOGIN', 'MANUAL')),
  CONSTRAINT attendance_records_status_check CHECK (status IN ('PRESENT', 'ABSENT', 'LEAVE', 'HALF_DAY'))
);

CREATE INDEX IF NOT EXISTS attendance_records_hotel_date_idx ON attendance_records(hotel_id, attendance_date DESC);
CREATE INDEX IF NOT EXISTS attendance_records_hotel_user_idx ON attendance_records(hotel_id, user_id);
GRANT ALL ON attendance_records TO hotel_pms_app;
