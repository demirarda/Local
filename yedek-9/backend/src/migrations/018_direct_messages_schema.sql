-- Direct Messages Schema (v1.2 - Send Message from Participant Profile)
-- Simple 1:1 direct messages between users

CREATE TABLE IF NOT EXISTS direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_direct_messages_from ON direct_messages(from_user_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_to ON direct_messages(to_user_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_created ON direct_messages(created_at);

COMMENT ON TABLE direct_messages IS '1:1 direct messages between users (v1.2 Send Message)';
