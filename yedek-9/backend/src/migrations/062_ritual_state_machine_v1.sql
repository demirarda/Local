-- Migration 062: Ritual state machine data + columns (son-part.md §2)
-- PRELOBBY → LIVE → WINDOW → ARCHIVED

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ritual_window_type') THEN
    CREATE TYPE ritual_window_type AS ENUM ('ephemeral', 'open_forum');
  END IF;
END $$;

ALTER TABLE rituals
  ADD COLUMN IF NOT EXISTS window_type ritual_window_type NOT NULL DEFAULT 'ephemeral';

UPDATE rituals SET status = 'prelobby' WHERE status::text = 'active';
UPDATE rituals SET status = 'window' WHERE status::text = 'ended';
UPDATE rituals SET status = 'archived' WHERE status::text = 'closed';

UPDATE rituals
SET window_ends_at = start_time
  + (COALESCE(duration, 60)::text || ' minutes')::interval
  + (COALESCE(live_window_hours, 3)::text || ' hours')::interval
WHERE window_ends_at IS NULL
  AND start_time IS NOT NULL;

ALTER TABLE rituals ALTER COLUMN status SET DEFAULT 'prelobby'::ritual_status;

ALTER TABLE ritual_attendance
  ADD COLUMN IF NOT EXISTS prelobby_grace_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS exact_details_unlocked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS join_count INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_rituals_status_start
  ON rituals (status, start_time);

CREATE INDEX IF NOT EXISTS idx_rituals_window_ends
  ON rituals (window_ends_at)
  WHERE status IN ('window'::ritual_status, 'ended'::ritual_status);
