-- LOCAL v2 §1 alignment
-- 1) users.verified:true doc remnant as durable column
-- 2) invite phase-B mechanics removed (handled in API layer)

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT false;

UPDATE users
SET verified = (COALESCE(email_verified, false) OR COALESCE(identity_verified, false));

CREATE OR REPLACE FUNCTION sync_users_verified_flag()
RETURNS TRIGGER AS $$
BEGIN
  NEW.verified := (COALESCE(NEW.email_verified, false) OR COALESCE(NEW.identity_verified, false));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_users_verified_flag ON users;
CREATE TRIGGER trg_sync_users_verified_flag
BEFORE INSERT OR UPDATE OF email_verified, identity_verified
ON users
FOR EACH ROW
EXECUTE FUNCTION sync_users_verified_flag();
