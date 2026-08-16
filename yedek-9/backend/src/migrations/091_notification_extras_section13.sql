-- LOCAL v2 §13 — bildirim ekleri: bell + 3-katman sinyal
-- Authority: LOCAL_Cursor_Build_Dokumani_v2-2.md §13

ALTER TABLE venue_follows
  ADD COLUMN IF NOT EXISTS bell BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS zone_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  zone_id UUID NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
  bell BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, zone_id)
);

CREATE INDEX IF NOT EXISTS idx_zone_follows_zone ON zone_follows (zone_id);
CREATE INDEX IF NOT EXISTS idx_zone_follows_user ON zone_follows (user_id);

-- SİNYAL katmanı — her event loglanır (yüzey/push ayrı)
CREATE TABLE IF NOT EXISTS notification_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(64) NOT NULL,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  entity_type VARCHAR(32),
  entity_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_signals_type_time
  ON notification_signals (event_type, created_at DESC);

ALTER TABLE memories
  ADD COLUMN IF NOT EXISTS upvote_notify_milestone INTEGER NOT NULL DEFAULT 0;

-- Drop restrictive type check if still present (new §13 types)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'notifications_type_check'
  ) THEN
    ALTER TABLE notifications DROP CONSTRAINT notifications_type_check;
  END IF;
END $$;
