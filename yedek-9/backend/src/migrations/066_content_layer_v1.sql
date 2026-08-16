-- Adım F4: İçerik katmanı — son-part.md §8 (forum, repost, share-2-person)

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'forum_comment_target') THEN
    CREATE TYPE forum_comment_target AS ENUM ('memory', 'ritual_window');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'share_object_type') THEN
    CREATE TYPE share_object_type AS ENUM (
      'memory', 'quote', 'photo', 'forward', 'quote_challenge', 'playlist',
      'ritual_send', 'friend_joining', 'venue_invite', 'badge', 'passport',
      'forum_thread', 'forum_repost', 'reaction_geliyorum', 'reaction_baktim'
    );
  END IF;
END $$;

ALTER TABLE rituals
  ADD COLUMN IF NOT EXISTS forum_surface VARCHAR(32) NOT NULL DEFAULT 'memories_only',
  ADD COLUMN IF NOT EXISTS reposted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS repost_count INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN rituals.forum_surface IS 'whole_window | memories_only — son-part.md §8.2';

CREATE TABLE IF NOT EXISTS forum_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ritual_id UUID NOT NULL REFERENCES rituals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type forum_comment_target NOT NULL,
  target_id UUID,
  parent_id UUID REFERENCES forum_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_forum_comments_ritual ON forum_comments(ritual_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_forum_comments_target ON forum_comments(ritual_id, target_type, target_id);

CREATE TABLE IF NOT EXISTS forum_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES forum_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vote SMALLINT NOT NULL CHECK (vote IN (-1, 1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_forum_votes_comment ON forum_votes(comment_id);

CREATE TABLE IF NOT EXISTS pulse_reposts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_ritual_id UUID NOT NULL REFERENCES rituals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES forum_comments(id) ON DELETE SET NULL,
  memory_id UUID REFERENCES memories(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pulse_reposts_active ON pulse_reposts(expires_at DESC);

CREATE TABLE IF NOT EXISTS share_objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  object_type share_object_type NOT NULL,
  object_id UUID,
  note TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT share_objects_note_requires_object CHECK (
    object_type IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_share_objects_pair ON share_objects(from_user_id, to_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_share_objects_to ON share_objects(to_user_id, created_at DESC);
