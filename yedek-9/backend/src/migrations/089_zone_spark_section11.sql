-- LOCAL v2 §11 — SPARK meetup + zone badge points
-- Authority: LOCAL_Cursor_Build_Dokumani_v2-2.md §11

CREATE TABLE IF NOT EXISTS spark_meetups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id UUID NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'pending',
  ritual_id UUID REFERENCES rituals(id) ON DELETE SET NULL,
  geo_lat DECIMAL(10, 8),
  geo_lng DECIMAL(11, 8),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_spark_status CHECK (status IN ('pending', 'ready', 'born', 'expired', 'cancelled'))
);

CREATE TABLE IF NOT EXISTS spark_meetup_members (
  meetup_id UUID NOT NULL REFERENCES spark_meetups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (meetup_id, user_id)
);

CREATE TABLE IF NOT EXISTS zone_badge_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind VARCHAR(40) NOT NULL,
  points INT NOT NULL DEFAULT 0,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_zone_badge_points_user ON zone_badge_points (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_spark_meetups_zone ON spark_meetups (zone_id, status);

-- Ensure rituals.zone_id exists for zone profile live/archive queries
ALTER TABLE rituals ADD COLUMN IF NOT EXISTS zone_id UUID REFERENCES zones(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_rituals_zone ON rituals (zone_id) WHERE zone_id IS NOT NULL;
