-- Vibe Pills Schema
-- Migration 009: Add user vibes table for vibe pills (Social Passport - Spec 7.2)

-- User vibes table
CREATE TABLE IF NOT EXISTS user_vibes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vibe VARCHAR(50) NOT NULL, -- e.g., 'chill', 'energetic', 'creative', 'social', 'focused'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, vibe)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_vibes_user ON user_vibes(user_id);

-- Add comment
COMMENT ON TABLE user_vibes IS 'User vibe pills for Social Passport (Spec 7.2)';
