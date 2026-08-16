-- LOCAL v2.0 delta — Waves 2–5 schema
-- Authority: LOCAL_Cursor_Build_Dokumani_v2-2.md §5–§13

-- §5 MOD-ENGINE
CREATE TABLE IF NOT EXISTS mod_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type VARCHAR(40) NOT NULL,
  target_id UUID,
  ritual_id UUID REFERENCES rituals(id) ON DELETE SET NULL,
  category_key VARCHAR(64),
  leave_after BOOLEAN NOT NULL DEFAULT false,
  package_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  correlation_score NUMERIC(6,3) DEFAULT 0,
  ai_suggestion JSONB,
  status VARCHAR(32) NOT NULL DEFAULT 'queued',
  level_applied VARCHAR(8),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mod_reports_status ON mod_reports (status, created_at DESC);

CREATE TABLE IF NOT EXISTS mod_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES mod_reports(id) ON DELETE SET NULL,
  level VARCHAR(8) NOT NULL,
  target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  moderator_id UUID REFERENCES users(id) ON DELETE SET NULL,
  second_moderator_id UUID REFERENCES users(id) ON DELETE SET NULL,
  founder_approved BOOLEAN,
  note TEXT,
  rs_delta NUMERIC(6,3),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mod_host_witness (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES mod_reports(id) ON DELETE CASCADE,
  host_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  answer VARCHAR(40),
  answered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- §6 Regular (venue-based)
CREATE TABLE IF NOT EXISTS venue_regulars (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  checkin_count INTEGER NOT NULL DEFAULT 0,
  last_checkin_at TIMESTAMPTZ,
  is_regular BOOLEAN NOT NULL DEFAULT false,
  regular_since TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, venue_id)
);

-- §7 SERIES
CREATE TABLE IF NOT EXISTS ritual_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  host_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recurrence_rule JSONB,
  active BOOLEAN NOT NULL DEFAULT true,
  week_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE rituals
  DROP CONSTRAINT IF EXISTS rituals_series_id_fkey;
ALTER TABLE rituals
  ADD CONSTRAINT rituals_series_id_fkey
  FOREIGN KEY (series_id) REFERENCES ritual_series(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS ritual_series_followers (
  series_id UUID NOT NULL REFERENCES ritual_series(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bell BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (series_id, user_id)
);

-- §8 audience_tag + follow bell
ALTER TABLE venue_slots
  ADD COLUMN IF NOT EXISTS audience_tag VARCHAR(32);

ALTER TABLE follows
  ADD COLUMN IF NOT EXISTS bell BOOLEAN NOT NULL DEFAULT false;

-- §10 Feedback chips
ALTER TABLE feedback
  ADD COLUMN IF NOT EXISTS chip_id VARCHAR(64),
  ADD COLUMN IF NOT EXISTS chip_route VARCHAR(32);

CREATE TABLE IF NOT EXISTS feedback_chip_stats (
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  chip_id VARCHAR(64) NOT NULL,
  feeling VARCHAR(16) NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (venue_id, chip_id, feeling)
);

-- §11 Zones
CREATE TABLE IF NOT EXISTS zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  geo_lat DECIMAL(10, 8),
  geo_lng DECIMAL(11, 8),
  marker_type VARCHAR(32) DEFAULT 'TREE',
  radius_m INTEGER NOT NULL DEFAULT 75,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- §8 Nomination triage
CREATE TABLE IF NOT EXISTS venue_nominations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nominator_id UUID REFERENCES users(id) ON DELETE SET NULL,
  source VARCHAR(40) NOT NULL,
  name TEXT,
  lat DECIMAL(10, 8),
  lng DECIMAL(11, 8),
  note TEXT,
  cluster_key VARCHAR(64),
  status VARCHAR(32) NOT NULL DEFAULT 'pooled',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_venue_nominations_status ON venue_nominations (status, created_at DESC);
