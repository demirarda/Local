-- Chat Messages table for ritual-scoped chat
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ritual_id UUID NOT NULL REFERENCES rituals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  message_type VARCHAR(20) DEFAULT 'user' CHECK (message_type IN ('user', 'host_announcement', 'system')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Memories table for ritual memories
CREATE TABLE IF NOT EXISTS memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ritual_id UUID NOT NULL REFERENCES rituals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  memory_type VARCHAR(20) DEFAULT 'ritual' CHECK (memory_type IN ('ritual', 'pulse')),
  expires_at TIMESTAMP, -- For pulse memories (24h)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for chat messages
CREATE INDEX IF NOT EXISTS idx_chat_messages_ritual ON chat_messages(ritual_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user ON chat_messages(user_id);

-- Indexes for memories
CREATE INDEX IF NOT EXISTS idx_memories_ritual ON memories(ritual_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memories_user ON memories(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memories_expires ON memories(expires_at) WHERE expires_at IS NOT NULL;
