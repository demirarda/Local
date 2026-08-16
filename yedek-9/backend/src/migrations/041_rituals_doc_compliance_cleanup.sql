-- Migration 041: Final rituals doc compliance cleanup for backend-yeni.md §2.4

-- 1) start_time should be TIMESTAMPTZ in doc.
ALTER TABLE rituals
  ALTER COLUMN start_time TYPE TIMESTAMPTZ USING start_time AT TIME ZONE 'UTC';

-- 2) capacity default should be 10 in doc.
ALTER TABLE rituals
  ALTER COLUMN capacity SET DEFAULT 10;

-- 3) If legacy columns still exist, merge into canonical ones then drop.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'rituals' AND column_name = 'related_hobbies'
  ) THEN
    UPDATE rituals
    SET mood_tags = CASE
      WHEN mood_tags IS NULL OR cardinality(mood_tags) = 0 THEN related_hobbies
      ELSE mood_tags
    END
    WHERE related_hobbies IS NOT NULL;

    ALTER TABLE rituals DROP COLUMN related_hobbies;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'rituals' AND column_name = 'check_in_keyword'
  ) THEN
    UPDATE rituals
    SET checkin_keyword = COALESCE(NULLIF(TRIM(checkin_keyword), ''), check_in_keyword)
    WHERE check_in_keyword IS NOT NULL;

    ALTER TABLE rituals DROP COLUMN check_in_keyword;
  END IF;
END $$;

-- 4) Ensure checkin keyword index exists on canonical column.
DROP INDEX IF EXISTS ux_rituals_check_in_keyword_ci;
CREATE UNIQUE INDEX IF NOT EXISTS ux_rituals_checkin_keyword_ci
ON rituals (LOWER(TRIM(checkin_keyword)))
WHERE checkin_keyword IS NOT NULL AND TRIM(checkin_keyword) <> '';
