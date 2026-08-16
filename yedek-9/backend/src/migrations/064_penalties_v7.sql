-- Adım 7: cezalar, askı, host-ban, replacement — son-part.md §7

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS penalty_suspended_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS host_ban_until TIMESTAMPTZ;

COMMENT ON COLUMN users.penalty_suspended_until IS 'No-show askısı: ritüel açamaz/katılamaz, Local World iz bırakamaz';
COMMENT ON COLUMN users.host_ban_until IS 'Host no-show ban: ritüel açamaz, katılabilir';

CREATE INDEX IF NOT EXISTS idx_users_penalty_suspended_until
  ON users(penalty_suspended_until) WHERE penalty_suspended_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_host_ban_until
  ON users(host_ban_until) WHERE host_ban_until IS NOT NULL;

CREATE TABLE IF NOT EXISTS penalty_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ritual_id UUID REFERENCES rituals(id) ON DELETE SET NULL,
  event_type VARCHAR(32) NOT NULL,
  strike INTEGER NOT NULL,
  rs_delta DECIMAL(6,4),
  suspension_hours INTEGER,
  host_ban_hours INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_penalty_events_rolling
  ON penalty_events(user_id, event_type, created_at DESC);

CREATE TABLE IF NOT EXISTS ritual_replacement_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ritual_id UUID NOT NULL REFERENCES rituals(id) ON DELETE CASCADE,
  vacated_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(16) NOT NULL DEFAULT 'open',
  filled_by_user_id UUID REFERENCES users(id),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  filled_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_replacement_open_user_ritual
  ON ritual_replacement_slots(ritual_id, vacated_by_user_id)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_replacement_open_ritual
  ON ritual_replacement_slots(ritual_id)
  WHERE status = 'open';

ALTER TABLE ritual_attendance
  ADD COLUMN IF NOT EXISTS joined_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS replacement_pending BOOLEAN NOT NULL DEFAULT false;

UPDATE ritual_attendance
SET joined_at = created_at
WHERE joined_at IS NULL;

ALTER TABLE rituals
  ADD COLUMN IF NOT EXISTS collapsed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS collapse_reason VARCHAR(32);
