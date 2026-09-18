-- Venue self-serve 100%: draft enum + weekly hours
-- Authority: mekan kayıt IA — web+mobil taslak · Gece Raporu kapanış+30dk
-- NOTE: new enum labels cannot be used in the same transaction (PG).
-- Index that filters on 'draft' lives in 125.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'draft'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'venue_application_status')
  ) THEN
    ALTER TYPE venue_application_status ADD VALUE 'draft';
  END IF;
END $$;

ALTER TABLE venue_applications
  ADD COLUMN IF NOT EXISTS weekly_hours JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS closing_time TIME;

ALTER TABLE venues
  ADD COLUMN IF NOT EXISTS weekly_hours JSONB NOT NULL DEFAULT '{}'::jsonb;

DROP INDEX IF EXISTS idx_venue_applications_one_pending_per_user;

COMMENT ON COLUMN venue_applications.weekly_hours IS 'Gunluk acilis/kapanis {mon:{open,close,closed},...}';
COMMENT ON COLUMN venues.weekly_hours IS 'Gece Raporu kapanis+30dk buradan; closing_time denormalize';
