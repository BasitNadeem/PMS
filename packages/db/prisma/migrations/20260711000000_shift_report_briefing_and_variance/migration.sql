ALTER TABLE "shift_reports"
  ADD COLUMN IF NOT EXISTS "handover_briefing" jsonb,
  ADD COLUMN IF NOT EXISTS "variance_reason" text,
  ADD COLUMN IF NOT EXISTS "discrepancy_alerted" boolean NOT NULL DEFAULT false;
