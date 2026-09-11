-- Manager-scheduled leave is separate from attendance so future leave cannot
-- be overwritten by a later PMS login. One row represents one staff day away.
CREATE TABLE IF NOT EXISTS leave_records (
  id               UUID NOT NULL DEFAULT gen_random_uuid(),
  hotel_id         UUID NOT NULL,
  user_id          UUID NOT NULL,
  leave_date       DATE NOT NULL,
  notes            TEXT,
  created_by_id    UUID NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT leave_records_pkey PRIMARY KEY (id),
  CONSTRAINT leave_records_hotel_id_fkey FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE,
  CONSTRAINT leave_records_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT leave_records_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT leave_records_hotel_user_date_key UNIQUE (hotel_id, user_id, leave_date)
);

CREATE INDEX IF NOT EXISTS leave_records_hotel_date_idx ON leave_records(hotel_id, leave_date ASC);
CREATE INDEX IF NOT EXISTS leave_records_hotel_user_idx ON leave_records(hotel_id, user_id);
GRANT ALL ON leave_records TO hotel_pms_app;
