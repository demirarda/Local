-- Pulse feed query performance indexes
CREATE INDEX IF NOT EXISTS idx_memories_pulse_created
  ON memories (created_at DESC)
  WHERE memory_type = 'pulse';

CREATE INDEX IF NOT EXISTS idx_memories_user_created
  ON memories (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_memories_ritual_created
  ON memories (ritual_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rituals_status_start
  ON rituals (status, start_time DESC)
  WHERE suspended_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_rituals_host_start
  ON rituals (host_id, start_time DESC);

CREATE INDEX IF NOT EXISTS idx_ritual_attendance_ritual_status
  ON ritual_attendance (ritual_id, status);

CREATE INDEX IF NOT EXISTS idx_friendships_user_status
  ON friendships (user_id, status, friend_id);

CREATE INDEX IF NOT EXISTS idx_follows_follower_following
  ON follows (follower_id, following_id);
