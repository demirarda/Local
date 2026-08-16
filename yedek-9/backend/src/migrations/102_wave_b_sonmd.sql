-- Wave B — sonMD kapalı ürün kararları (1–3 Ağu)
-- weather_cancel · collaborator · account_privacy/follow_requests ·
-- feedback_eligibility · saves · mutes · chat edit/reactions · memory audience

-- ─── rituals: host cancel metadata ───
ALTER TABLE rituals
  ADD COLUMN IF NOT EXISTS cancel_reason VARCHAR(32),
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES users(id);

COMMENT ON COLUMN rituals.cancel_reason IS
  'host_cancel | weather_cancel | under_min | system | other';

-- ─── weather cancel abuse counter (MOD desen) ───
CREATE TABLE IF NOT EXISTS weather_cancel_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ritual_id UUID NOT NULL REFERENCES rituals(id) ON DELETE CASCADE,
  category_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_weather_cancel_host_created
  ON weather_cancel_signals (host_id, created_at DESC);

-- ─── organizer collaborators (Series / event_group / venue_event only) ───
DO $$ BEGIN
  CREATE TYPE collaborator_scope AS ENUM ('series', 'event_group', 'venue_event');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS organizers_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope collaborator_scope NOT NULL,
  scope_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invited_by UUID REFERENCES users(id),
  permissions TEXT[] NOT NULL DEFAULT ARRAY['announce','participant_comms','instance_manage']::TEXT[],
  status VARCHAR(16) NOT NULL DEFAULT 'active'
    CHECK (status IN ('pending', 'active', 'revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (scope, scope_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_collab_user ON organizers_collaborators (user_id)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_collab_scope ON organizers_collaborators (scope, scope_id)
  WHERE status = 'active';

-- ─── account privacy + follow requests ───
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS account_privacy VARCHAR(16) NOT NULL DEFAULT 'OPEN'
    CHECK (account_privacy IN ('OPEN', 'CLOSED'));

-- Merge legacy public_profile=false → CLOSED (one-shot soft)
UPDATE user_settings
SET account_privacy = 'CLOSED'
WHERE COALESCE(public_profile, true) = false
  AND account_privacy = 'OPEN';

CREATE TABLE IF NOT EXISTS follow_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(16) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  UNIQUE (from_user_id, to_user_id)
);
CREATE INDEX IF NOT EXISTS idx_follow_requests_to_pending
  ON follow_requests (to_user_id, created_at DESC)
  WHERE status = 'pending';

-- ─── FB eligibility snapshot (block-immune) ───
CREATE TABLE IF NOT EXISTS feedback_eligibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ritual_id UUID NOT NULL REFERENCES rituals(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sealed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source VARCHAR(32) NOT NULL DEFAULT 'co_presence'
    CHECK (source IN ('co_presence', 'main_seal', 'sub_seal')),
  UNIQUE (ritual_id, from_user_id, to_user_id)
);
CREATE INDEX IF NOT EXISTS idx_fb_elig_ritual_from
  ON feedback_eligibility (ritual_id, from_user_id);

-- ─── saves (private pointer) + mutes ───
DO $$ BEGIN
  CREATE TYPE save_object_type AS ENUM ('ritual', 'venue', 'zone', 'memory');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS user_saves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  object_type save_object_type NOT NULL,
  object_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, object_type, object_id)
);
CREATE INDEX IF NOT EXISTS idx_user_saves_user ON user_saves (user_id, created_at DESC);

DO $$ BEGIN
  CREATE TYPE mute_object_type AS ENUM ('user', 'series', 'venue', 'category');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS user_mutes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  object_type mute_object_type NOT NULL,
  object_id UUID,
  object_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_mutes_unique_id
  ON user_mutes (user_id, object_type, object_id)
  WHERE object_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_mutes_unique_key
  ON user_mutes (user_id, object_type, object_key)
  WHERE object_key IS NOT NULL;

-- ─── chat: edit window + reactions ───
ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS chat_message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL CHECK (emoji IN ('🤝', '😂', '🙌', '👀', '💡', '❓')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (message_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_chat_reactions_message
  ON chat_message_reactions (message_id);

-- ─── memory audience WINDOW|CIRCLE|CITY ───
ALTER TABLE memories
  ADD COLUMN IF NOT EXISTS audience VARCHAR(16);

UPDATE memories
SET audience = CASE
  WHEN COALESCE(memory_scope::text, 'solo') = 'all' THEN 'CITY'
  WHEN COALESCE(memory_scope::text, 'solo') = 'pulse' THEN 'CIRCLE'
  ELSE 'WINDOW'
END
WHERE audience IS NULL;

ALTER TABLE memories
  ALTER COLUMN audience SET DEFAULT 'WINDOW';

DO $$ BEGIN
  ALTER TABLE memories
    ADD CONSTRAINT chk_memories_audience
    CHECK (audience IN ('WINDOW', 'CIRCLE', 'CITY'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
