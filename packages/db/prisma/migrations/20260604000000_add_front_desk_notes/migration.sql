CREATE TABLE IF NOT EXISTS front_desk_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  completed_by_id UUID REFERENCES users(id),
  created_by_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS front_desk_notes_hotel_id_idx 
  ON front_desk_notes(hotel_id);

CREATE INDEX IF NOT EXISTS front_desk_notes_hotel_id_is_completed_idx 
  ON front_desk_notes(hotel_id, is_completed);
