-- son-part.md §9 — venue_badge onboarding adimi

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'venue_onboarding_step' AND e.enumlabel = 'venue_badge'
  ) THEN
    ALTER TYPE venue_onboarding_step ADD VALUE 'venue_badge';
  END IF;
END $$;
