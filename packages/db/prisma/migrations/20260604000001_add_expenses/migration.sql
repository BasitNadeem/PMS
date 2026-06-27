CREATE TABLE expenses (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id       UUID         NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  date           DATE         NOT NULL,
  category       VARCHAR(50)  NOT NULL,
  description    TEXT         NOT NULL,
  amount         INTEGER      NOT NULL,
  payment_method VARCHAR(50)  NOT NULL,
  paid_to        VARCHAR(255) NOT NULL,
  receipt_ref    VARCHAR(255),
  notes          TEXT,
  created_by_id  UUID         NOT NULL REFERENCES users(id),
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX expenses_hotel_id_idx      ON expenses(hotel_id);
CREATE INDEX expenses_hotel_id_date_idx ON expenses(hotel_id, date);
CREATE INDEX expenses_hotel_id_cat_idx  ON expenses(hotel_id, category);
