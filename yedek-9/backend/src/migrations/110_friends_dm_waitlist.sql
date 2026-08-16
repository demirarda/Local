-- 110 — Wave 5 F1.5: Friends-DM (karşılıklı arkadaş) + Ritual waitlist
-- Friends-DM: yalnız friendships.status='accepted' çiftler. Cold-DM / message-request yok.
-- Waitlist: masa dolduğunda sıraya gir; koltuk açılınca FIFO terfi.

-- ---------------------------------------------------------------------------
-- Friends-DM threads — (user_a, user_b) kanonik sıralı tekil çift
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dm_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  last_message_sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
  last_read_at_a TIMESTAMPTZ,
  last_read_at_b TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT dm_threads_pair_order CHECK (user_a < user_b),
  CONSTRAINT dm_threads_pair_unique UNIQUE (user_a, user_b)
);

CREATE INDEX IF NOT EXISTS idx_dm_threads_user_a ON dm_threads (user_a, last_message_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_dm_threads_user_b ON dm_threads (user_b, last_message_at DESC NULLS LAST);

-- ---------------------------------------------------------------------------
-- Friends-DM messages
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dm_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES dm_threads(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dm_messages_thread ON dm_messages (thread_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dm_messages_sender ON dm_messages (sender_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Ritual waitlist — masa dolduğunda sıra
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ritual_waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ritual_id UUID NOT NULL REFERENCES rituals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  position INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting', 'promoted', 'left', 'expired')),
  promoted_at TIMESTAMPTZ,
  left_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ritual_waitlist_unique UNIQUE (ritual_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_ritual_waitlist_queue
  ON ritual_waitlist (ritual_id, position)
  WHERE status = 'waiting';

CREATE INDEX IF NOT EXISTS idx_ritual_waitlist_user
  ON ritual_waitlist (user_id, created_at DESC);
