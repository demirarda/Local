-- User Interests Schema
-- Migration 013: Add user interests table for shared interests feature

-- User interests table (category-level interests)
CREATE TABLE IF NOT EXISTS user_interests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category VARCHAR(100) NOT NULL, -- e.g., 'music', 'sports', 'art', 'food', 'tech', etc.
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, category)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_interests_user ON user_interests(user_id);
CREATE INDEX IF NOT EXISTS idx_user_interests_category ON user_interests(category);

-- Add comments
COMMENT ON TABLE user_interests IS 'User interests by category (for shared interests feature)';
