-- LTE-3 §3.6: Early cancel (6h+) grants "Nazik Iptal" badge

CREATE TABLE IF NOT EXISTS user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_key VARCHAR(64) NOT NULL,
  badge_label VARCHAR(128) NOT NULL,
  awarded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  source_ritual_id UUID REFERENCES rituals(id) ON DELETE SET NULL,
  UNIQUE(user_id, badge_key)
);

CREATE INDEX IF NOT EXISTS idx_user_badges_user_id ON user_badges(user_id);
