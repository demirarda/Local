-- Blocked keywords per user (hide content containing these words)
CREATE TABLE IF NOT EXISTS user_blocked_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  keyword VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_user_blocked_keywords_user ON user_blocked_keywords(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_blocked_keywords_user_keyword ON user_blocked_keywords(user_id, LOWER(keyword));
