-- NOTIF + recurring + seating cache

ALTER TABLE rituals
  ADD COLUMN IF NOT EXISTS parent_ritual_id UUID REFERENCES rituals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_rituals_parent ON rituals(parent_ritual_id) WHERE parent_ritual_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rituals_is_recurring ON rituals(is_recurring) WHERE is_recurring = true;

ALTER TABLE venues
  ADD COLUMN IF NOT EXISTS seating_key_cache VARCHAR(32);

ALTER TABLE ritual_attendance
  ADD COLUMN IF NOT EXISTS exact_details_notified_at TIMESTAMPTZ;

ALTER TABLE rituals
  ADD COLUMN IF NOT EXISTS door_closing_notified_at TIMESTAMPTZ;
