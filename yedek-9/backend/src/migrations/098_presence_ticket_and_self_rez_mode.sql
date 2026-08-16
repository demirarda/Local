-- LOCAL v2 §2 completion: self-rez mode + buradasin ticket lifecycle

ALTER TABLE rituals
  ADD COLUMN IF NOT EXISTS self_rez_mode VARCHAR(16);

CREATE TABLE IF NOT EXISTS presence_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ritual_id UUID NOT NULL REFERENCES rituals(id) ON DELETE CASCADE,
  ticket_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_presence_tickets_user_active
  ON presence_tickets (user_id, expires_at DESC)
  WHERE revoked_at IS NULL;
