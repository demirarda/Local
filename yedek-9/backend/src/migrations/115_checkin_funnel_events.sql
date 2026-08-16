-- Check-in funnel / C1–C5 monitoring events (LOCAL_CheckIn_Sistemi §8)
CREATE TABLE IF NOT EXISTS checkin_funnel_events (
  id BIGSERIAL PRIMARY KEY,
  ritual_id UUID NULL,
  user_id UUID NULL,
  event TEXT NOT NULL,
  meta JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_checkin_funnel_created
  ON checkin_funnel_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_checkin_funnel_event_created
  ON checkin_funnel_events (event, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_checkin_funnel_ritual
  ON checkin_funnel_events (ritual_id, created_at DESC)
  WHERE ritual_id IS NOT NULL;
