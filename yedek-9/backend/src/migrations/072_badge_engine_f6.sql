-- F6: Badge motoru + Live Activity — son-part.md §10, §8.4

ALTER TABLE badges
  ADD COLUMN IF NOT EXISTS spec_category VARCHAR(32),
  ADD COLUMN IF NOT EXISTS badge_level VARCHAR(16) DEFAULT 'novice',
  ADD COLUMN IF NOT EXISTS rule_engine JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS assignment_layer VARCHAR(16) DEFAULT 'rule';

ALTER TABLE user_badges
  ADD COLUMN IF NOT EXISTS badge_level VARCHAR(16),
  ADD COLUMN IF NOT EXISTS highlighted BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS highlighted_badge_keys TEXT[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS badge_llm_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ritual_id UUID REFERENCES rituals(id) ON DELETE SET NULL,
  suggested_slug VARCHAR(100) NOT NULL,
  suggested_level VARCHAR(16) DEFAULT 'novice',
  reason TEXT,
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS live_activity_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ritual_id UUID NOT NULL REFERENCES rituals(id) ON DELETE CASCADE,
  platform VARCHAR(16) DEFAULT 'unknown',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  last_push_at TIMESTAMPTZ,
  UNIQUE (user_id, ritual_id)
);

CREATE INDEX IF NOT EXISTS idx_badge_llm_suggestions_status ON badge_llm_suggestions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_live_activity_sessions_ritual ON live_activity_sessions(ritual_id) WHERE ended_at IS NULL;
