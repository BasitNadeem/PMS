CREATE TABLE whatsapp_briefing_logs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id        UUID        NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  recipient_number VARCHAR(20) NOT NULL,
  message_text    TEXT        NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  error_message   TEXT,
  meta_message_id VARCHAR(255),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX wab_logs_hotel_id_idx ON whatsapp_briefing_logs(hotel_id);
CREATE INDEX wab_logs_sent_at_idx  ON whatsapp_briefing_logs(hotel_id, sent_at);
