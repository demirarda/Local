-- Suspend user and ritual for moderation (admin)
-- Migration 020

-- Users: suspended_at set by admin; when set, user is blocked from login/listings
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP DEFAULT NULL;

-- Rituals: suspended_at set by admin; when set, exclude from Pulse/City Rhythm
ALTER TABLE rituals
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_users_suspended_at ON users(suspended_at) WHERE suspended_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rituals_suspended_at ON rituals(suspended_at) WHERE suspended_at IS NOT NULL;

COMMENT ON COLUMN users.suspended_at IS 'Set by admin; user is blocked when non-null';
COMMENT ON COLUMN rituals.suspended_at IS 'Set by admin; ritual hidden from listings when non-null';
