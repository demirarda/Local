-- User Settings Schema
-- Migration 012: Add user settings and notification preferences

-- User settings table
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  
  -- Notification preferences
  notify_ritual_live BOOLEAN DEFAULT true,
  notify_friend_joined_ritual BOOLEAN DEFAULT true,
  notify_feedback_available BOOLEAN DEFAULT true,
  notify_ritual_starting_soon BOOLEAN DEFAULT true,
  notify_ritual_almost_full BOOLEAN DEFAULT true,
  
  -- Privacy settings
  allow_p2p_feedback_from_friends_only BOOLEAN DEFAULT false,
  show_rs_score_publicly BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for user settings
CREATE INDEX IF NOT EXISTS idx_user_settings_user ON user_settings(user_id);

-- Add comments
COMMENT ON TABLE user_settings IS 'User settings and preferences (notifications, privacy)';
