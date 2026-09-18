-- Totem-ID panelden uzaktan deaktive (EK-1 🔒) + waitlist OFFER status

ALTER TABLE venue_portals
  ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_venue_portals_active
  ON venue_portals (venue_id)
  WHERE deactivated_at IS NULL;

DO $$
DECLARE
  cname TEXT;
BEGIN
  FOR cname IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'ritual_waitlist'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%waiting%'
  LOOP
    EXECUTE format('ALTER TABLE ritual_waitlist DROP CONSTRAINT %I', cname);
  END LOOP;

  ALTER TABLE ritual_waitlist
    ADD CONSTRAINT ritual_waitlist_status_offered_chk
    CHECK (status IN ('waiting', 'promoted', 'left', 'expired', 'offered'));
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;
