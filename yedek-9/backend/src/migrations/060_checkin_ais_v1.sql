-- Migration 060: Check-in + AIS alignment (son-part.md §3)

ALTER TABLE rituals
  ADD COLUMN IF NOT EXISTS location_type VARCHAR(20) DEFAULT 'custom',
  ADD COLUMN IF NOT EXISTS keyword_revealed_at TIMESTAMPTZ;

ALTER TABLE ritual_attendance
  ADD COLUMN IF NOT EXISTS ais_score DECIMAL(4, 2),
  ADD COLUMN IF NOT EXISTS checkin_manual_fallback BOOLEAN NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_rituals_location_type'
  ) THEN
    ALTER TABLE rituals
      ADD CONSTRAINT chk_rituals_location_type
      CHECK (location_type IN ('custom', 'venue', 'zone', 'moving'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_rituals_keyword_revealed
  ON rituals (keyword_revealed_at)
  WHERE keyword_revealed_at IS NOT NULL;
