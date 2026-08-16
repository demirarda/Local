-- Migration 053: Align notifications schema with backend-yeni.md §2.15 (lines 493-514)

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_sent BOOLEAN DEFAULT false;

UPDATE notifications
SET is_read = COALESCE(read, false)
WHERE is_read IS DISTINCT FROM COALESCE(read, false);

ALTER TABLE notifications
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN created_at SET DEFAULT NOW();

CREATE OR REPLACE FUNCTION trg_sync_notifications_read_flags()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_read IS NULL THEN
    NEW.is_read := COALESCE(NEW.read, false);
  END IF;
  IF NEW.read IS NULL THEN
    NEW.read := COALESCE(NEW.is_read, false);
  END IF;

  IF NEW.is_read IS DISTINCT FROM NEW.read THEN
    IF COALESCE(NEW.is_read, false) = true THEN
      NEW.read := true;
    ELSE
      NEW.is_read := COALESCE(NEW.read, false);
    END IF;
  END IF;

  NEW.is_sent := COALESCE(NEW.is_sent, false);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_notifications_read_flags ON notifications;
CREATE TRIGGER trg_sync_notifications_read_flags
BEFORE INSERT OR UPDATE ON notifications
FOR EACH ROW
EXECUTE FUNCTION trg_sync_notifications_read_flags();

CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_is_sent ON notifications(user_id, is_sent);

