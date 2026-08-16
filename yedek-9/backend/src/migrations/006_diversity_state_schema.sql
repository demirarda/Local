-- Diversity Regulator State Schema
-- Stores diversity state for EMA calculation

-- User Diversity State table
CREATE TABLE IF NOT EXISTS user_diversity_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ds_prev DECIMAL(5,3) DEFAULT 0.50, -- Previous DS value (EMA state)
  last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_user_diversity_state_user ON user_diversity_state(user_id);
