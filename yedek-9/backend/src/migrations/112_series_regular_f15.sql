-- Absolute 100 B — Series-Regular F1.5
-- SERIES_REGULAR_ONLY visibility + series_regulars roster

DO $$ BEGIN
  ALTER TYPE ritual_visibility ADD VALUE IF NOT EXISTS 'series_regular_only';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS series_regulars (
  series_id UUID NOT NULL REFERENCES ritual_series(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sealed_count INT NOT NULL DEFAULT 0,
  window_instances INT NOT NULL DEFAULT 8,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (series_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_series_regulars_user ON series_regulars (user_id);
