-- §1 identity stub acceptance — username / name_locked / change cooldowns
-- sonMD: USERNAME_CHANGE_D:90 · NAME_CHANGE_D:90 · name_locked on KYC

CREATE EXTENSION IF NOT EXISTS citext;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS username CITEXT,
  ADD COLUMN IF NOT EXISTS display_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS name_locked BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS username_changed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS name_changed_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_unique
  ON users (username)
  WHERE username IS NOT NULL;

CREATE TABLE IF NOT EXISTS reserved_usernames (
  username CITEXT PRIMARY KEY,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO reserved_usernames (username, reason) VALUES
  ('admin', 'system'),
  ('local', 'brand'),
  ('support', 'system'),
  ('mod', 'system'),
  ('moderator', 'system'),
  ('official', 'system'),
  ('help', 'system'),
  ('root', 'system')
ON CONFLICT (username) DO NOTHING;
