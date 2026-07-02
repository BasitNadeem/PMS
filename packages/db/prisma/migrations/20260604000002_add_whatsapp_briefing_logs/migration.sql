CREATE TABLE IF NOT EXISTS whatsapp_briefing_logs (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id         UUID        NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  sent_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  recipient_number VARCHAR(20) NOT NULL,
  message_text     TEXT        NOT NULL,
  status           VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  error_message    TEXT,
  meta_message_id  VARCHAR(255),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wab_logs_hotel_id_idx ON whatsapp_briefing_logs(hotel_id);
CREATE INDEX IF NOT EXISTS wab_logs_sent_at_idx  ON whatsapp_briefing_logs(hotel_id, sent_at);

GRANT ALL ON whatsapp_briefing_logs TO hotel_pms_app;
