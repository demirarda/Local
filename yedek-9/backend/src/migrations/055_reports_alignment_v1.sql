-- Migration 055: Align reports schema with backend-yeni.md §2.17 (lines 543-564)

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_reason') THEN
    CREATE TYPE report_reason AS ENUM ('uncomfortable', 'disrespectful', 'wrong_fit', 'other');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_status_doc') THEN
    CREATE TYPE report_status_doc AS ENUM ('pending', 'reviewed', 'actioned', 'dismissed');
  END IF;
END $$;

ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS ritual_id UUID REFERENCES rituals(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_false_report BOOLEAN;

UPDATE reports
SET ritual_id = reported_ritual_id
WHERE ritual_id IS NULL
  AND reported_ritual_id IS NOT NULL;

UPDATE reports
SET reported_ritual_id = ritual_id
WHERE reported_ritual_id IS NULL
  AND ritual_id IS NOT NULL;

UPDATE reports
SET reason = (
  CASE
    WHEN reason::text IN ('uncomfortable', 'disrespectful', 'wrong_fit', 'other') THEN reason::text
    ELSE 'other'
  END
)::report_reason;

UPDATE reports
SET status = (
  CASE
    WHEN status::text = 'resolved' THEN 'actioned'
    WHEN status::text IN ('pending', 'reviewed', 'actioned', 'dismissed') THEN status::text
    ELSE 'pending'
  END
)::report_status_doc;

ALTER TABLE reports
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN created_at SET DEFAULT NOW();

ALTER TABLE reports
  ALTER COLUMN status DROP DEFAULT;

ALTER TABLE reports
  ALTER COLUMN reason TYPE report_reason USING reason::report_reason,
  ALTER COLUMN status TYPE report_status_doc USING status::report_status_doc;

ALTER TABLE reports
  ALTER COLUMN status SET DEFAULT 'pending'::report_status_doc;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'reports_status_check'
      AND conrelid = 'reports'::regclass
  ) THEN
    ALTER TABLE reports DROP CONSTRAINT reports_status_check;
  END IF;
END $$;

ALTER TABLE reports
  ALTER COLUMN reported_user_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'reports_status_check'
      AND conrelid = 'reports'::regclass
  ) THEN
    ALTER TABLE reports
      ADD CONSTRAINT reports_status_check
      CHECK (status::text IN ('pending', 'reviewed', 'actioned', 'dismissed'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION trg_sync_reports_ritual_columns()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ritual_id IS NULL AND NEW.reported_ritual_id IS NOT NULL THEN
    NEW.ritual_id := NEW.reported_ritual_id;
  END IF;
  IF NEW.reported_ritual_id IS NULL AND NEW.ritual_id IS NOT NULL THEN
    NEW.reported_ritual_id := NEW.ritual_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_reports_ritual_columns ON reports;
CREATE TRIGGER trg_sync_reports_ritual_columns
BEFORE INSERT OR UPDATE ON reports
FOR EACH ROW
EXECUTE FUNCTION trg_sync_reports_ritual_columns();

CREATE INDEX IF NOT EXISTS idx_reports_ritual_id ON reports(ritual_id);
CREATE INDEX IF NOT EXISTS idx_reports_is_false_report ON reports(is_false_report);

