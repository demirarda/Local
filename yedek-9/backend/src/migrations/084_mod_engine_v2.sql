-- LOCAL v2 §5 MOD-ENGINE extensions
-- Authority: LOCAL_Cursor_Build_Dokumani_v2-2.md §5

CREATE TABLE IF NOT EXISTS mod_sanctions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  level VARCHAR(8) NOT NULL,
  kind VARCHAR(48) NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMPTZ,
  action_id UUID REFERENCES mod_actions(id) ON DELETE SET NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mod_sanctions_user_active
  ON mod_sanctions (user_id, active, kind) WHERE active = true;

CREATE TABLE IF NOT EXISTS mod_appeals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id UUID NOT NULL REFERENCES mod_actions(id) ON DELETE CASCADE,
  appellant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  decision_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_mod_appeals_status ON mod_appeals (status, created_at DESC);

CREATE TABLE IF NOT EXISTS location_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sharer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ritual_id UUID REFERENCES rituals(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_location_shares_active
  ON location_shares (sharer_id, friend_id, expires_at);

ALTER TABLE memories
  ADD COLUMN IF NOT EXISTS csam_scan_status VARCHAR(32),
  ADD COLUMN IF NOT EXISTS csam_scan_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS csam_scan_meta JSONB DEFAULT '{}'::jsonb;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS mod_warning_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE mod_reports
  ADD COLUMN IF NOT EXISTS queue_lane VARCHAR(24) NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS sla_due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS description TEXT;
