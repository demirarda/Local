-- Ritual Invites schema
-- Simple token-based invites for invite_only rituals

CREATE TABLE IF NOT EXISTS ritual_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ritual_id UUID NOT NULL REFERENCES rituals(id) ON DELETE CASCADE,
  inviter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invitee_id UUID REFERENCES users(id) ON DELETE SET NULL,
  token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  used_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ritual_invites_ritual ON ritual_invites(ritual_id);
CREATE INDEX IF NOT EXISTS idx_ritual_invites_inviter ON ritual_invites(inviter_id);

