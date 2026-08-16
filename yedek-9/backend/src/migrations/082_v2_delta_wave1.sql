-- LOCAL v2.0 delta — Wave 1 foundations (identity, keyword, memory, ghost)
-- Authority: LOCAL_Cursor_Build_Dokumani_v2-2.md §1–§3

-- §1 Identity gate
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS identity_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS age_ok BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS identity_track VARCHAR(20) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS uni_label_visible BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ghost_mode BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hosted_count_visible BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS regular_vitrine_visible BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS solo_ceiling_lifted BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS identity_hashes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_hash VARCHAR(128) NOT NULL UNIQUE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  blacklisted BOOLEAN NOT NULL DEFAULT false,
  blacklisted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_identity_hashes_hash ON identity_hashes (identity_hash);
CREATE INDEX IF NOT EXISTS idx_identity_hashes_blacklist ON identity_hashes (blacklisted) WHERE blacklisted = true;

CREATE TABLE IF NOT EXISTS identity_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(64) NOT NULL DEFAULT 'stub',
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  document_type VARCHAR(32),
  age_ok BOOLEAN,
  identity_hash VARCHAR(128),
  provider_session_id VARCHAR(255),
  error_code VARCHAR(64),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_identity_verifications_user ON identity_verifications (user_id, created_at DESC);

-- §2 Keyword v2 — code attempts + escrow
ALTER TABLE rituals
  ADD COLUMN IF NOT EXISTS checkin_code_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS keyword_escrow_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS keyword_escrow_offered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS spark_born BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS event_group_id UUID,
  ADD COLUMN IF NOT EXISTS series_id UUID,
  ADD COLUMN IF NOT EXISTS series_week INTEGER;

CREATE TABLE IF NOT EXISTS ritual_checkin_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ritual_id UUID NOT NULL REFERENCES rituals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (ritual_id, user_id)
);

-- §3 Memory v2 — draft/rulo + damga
ALTER TABLE memories
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS captured_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stamp_ritual_id UUID,
  ADD COLUMN IF NOT EXISTS stamp_geo_lat DECIMAL(10, 8),
  ADD COLUMN IF NOT EXISTS stamp_geo_lng DECIMAL(11, 8),
  ADD COLUMN IF NOT EXISTS stamp_label TEXT,
  ADD COLUMN IF NOT EXISTS is_retro BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS upvote_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS downvote_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comment_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS echo_count INTEGER NOT NULL DEFAULT 0;

UPDATE memories
SET captured_at = COALESCE(captured_at, created_at),
    published_at = COALESCE(published_at, created_at)
WHERE captured_at IS NULL OR published_at IS NULL;

CREATE TABLE IF NOT EXISTS memory_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vote SMALLINT NOT NULL CHECK (vote IN (-1, 1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (memory_id, user_id)
);

CREATE TABLE IF NOT EXISTS memory_echoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (memory_id, user_id)
);

CREATE TABLE IF NOT EXISTS memory_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Event groups (ZONE-EVENT umbrella)
CREATE TABLE IF NOT EXISTS ritual_event_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  zone_id UUID,
  capacity_total INTEGER,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE rituals
  DROP CONSTRAINT IF EXISTS rituals_event_group_id_fkey;
ALTER TABLE rituals
  ADD CONSTRAINT rituals_event_group_id_fkey
  FOREIGN KEY (event_group_id) REFERENCES ritual_event_groups(id) ON DELETE SET NULL;
