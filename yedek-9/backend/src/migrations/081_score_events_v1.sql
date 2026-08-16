-- son-part1.md §2 — append-only score event log (kalibrasyon / denetim)
CREATE TABLE IF NOT EXISTS score_events (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ritual_id UUID REFERENCES rituals(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  delta DOUBLE PRECISION,
  inputs JSONB DEFAULT '{}'::jsonb,
  breakdown JSONB DEFAULT '{}'::jsonb,
  config_version TEXT NOT NULL DEFAULT '1.0.0',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_score_events_user_ts ON score_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_score_events_ritual ON score_events(ritual_id) WHERE ritual_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_score_events_type ON score_events(event_type, created_at DESC);

COMMENT ON TABLE score_events IS 'Append-only RS/DS/penalty event log with config_version snapshot';
