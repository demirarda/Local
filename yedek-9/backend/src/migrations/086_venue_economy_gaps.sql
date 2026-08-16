-- LOCAL v2 §8 gap-close: mini-report one-shot · takeover quota · brand_slot · chip trends index
ALTER TABLE venues
  ADD COLUMN IF NOT EXISTS mini_report_month_key VARCHAR(7),
  ADD COLUMN IF NOT EXISTS included_takeover_month_key VARCHAR(7),
  ADD COLUMN IF NOT EXISTS included_takeovers_used INTEGER NOT NULL DEFAULT 0;

ALTER TABLE venue_slots
  ADD COLUMN IF NOT EXISTS brand_priority BOOLEAN NOT NULL DEFAULT false;

-- Partial index: no NOW() — predicates must be IMMUTABLE
CREATE INDEX IF NOT EXISTS idx_venues_takeover_until_nn
  ON venues (takeover_until)
  WHERE takeover_until IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_venue_slots_audience
  ON venue_slots (audience_tag)
  WHERE audience_tag IS NOT NULL;
