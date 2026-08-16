-- BC3 Trend Supervisor Schema
-- Stores RS delta history for trend analysis

-- RS Delta History table
CREATE TABLE IF NOT EXISTS rs_delta_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ritual_id UUID NOT NULL REFERENCES rituals(id) ON DELETE CASCADE,
  delta DECIMAL(5,3) NOT NULL, -- RS delta for this ritual
  old_rs DECIMAL(3,1) NOT NULL, -- RS before this ritual
  new_rs DECIMAL(3,1) NOT NULL, -- RS after this ritual
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_rs_delta_history_user ON rs_delta_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rs_delta_history_ritual ON rs_delta_history(ritual_id);
