-- §10 BADGE completion: slot badge conditions

ALTER TABLE venue_slots
  ADD COLUMN IF NOT EXISTS required_badge_slug VARCHAR(64),
  ADD COLUMN IF NOT EXISTS min_badge_level VARCHAR(16);

COMMENT ON COLUMN venue_slots.required_badge_slug IS 'Host must hold this badge slug (son-part.md §10)';
COMMENT ON COLUMN venue_slots.min_badge_level IS 'Minimum badge level: novice | regular | master';
