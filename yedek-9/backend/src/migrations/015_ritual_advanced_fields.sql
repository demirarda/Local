-- Add advanced fields for rituals: live window, min RS threshold, related hobbies

ALTER TABLE rituals
  ADD COLUMN IF NOT EXISTS live_window_hours INTEGER DEFAULT 3,
  ADD COLUMN IF NOT EXISTS min_rs_threshold INTEGER,
  ADD COLUMN IF NOT EXISTS related_hobbies TEXT[] DEFAULT '{}';

-- Add constraints (only if they don't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_live_window_hours'
  ) THEN
    ALTER TABLE rituals
      ADD CONSTRAINT chk_live_window_hours
      CHECK (live_window_hours IN (3, 6, 12, 24));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_min_rs_threshold'
  ) THEN
    ALTER TABLE rituals
      ADD CONSTRAINT chk_min_rs_threshold
      CHECK (min_rs_threshold IS NULL OR (min_rs_threshold >= 0 AND min_rs_threshold <= 100));
  END IF;
END $$;

