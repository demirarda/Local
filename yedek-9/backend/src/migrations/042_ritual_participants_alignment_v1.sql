-- Migration 042: Align ritual_attendance with backend-yeni.md §2.5 ritual_participants

-- 1) Enum types required by spec
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ritual_participant_status') THEN
    CREATE TYPE ritual_participant_status AS ENUM ('confirmed', 'waitlisted', 'cancelled', 'no_show');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ritual_cancellation_type') THEN
    CREATE TYPE ritual_cancellation_type AS ENUM ('early', 'late');
  END IF;
END $$;

-- 2) Rename check-in timestamp to spec name
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ritual_attendance' AND column_name = 'check_in_time'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ritual_attendance' AND column_name = 'checkin_at'
  ) THEN
    ALTER TABLE ritual_attendance RENAME COLUMN check_in_time TO checkin_at;
  END IF;
END $$;

-- 3) Add missing spec columns
ALTER TABLE ritual_attendance
  ADD COLUMN IF NOT EXISTS checkin_gps_lat DECIMAL(9,6),
  ADD COLUMN IF NOT EXISTS checkin_gps_lng DECIMAL(9,6),
  ADD COLUMN IF NOT EXISTS checkin_keyword_ok BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS left_early_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_type ritual_cancellation_type;

-- 4) Normalize legacy statuses to spec
UPDATE ritual_attendance
SET status = 'confirmed'
WHERE status::text IN ('joined', 'checked_in', 'left_early');

-- 5) Change status to enum and default confirmed
ALTER TABLE ritual_attendance DROP CONSTRAINT IF EXISTS ritual_attendance_status_check;
ALTER TABLE ritual_attendance ALTER COLUMN status DROP DEFAULT;
ALTER TABLE ritual_attendance
  ALTER COLUMN status TYPE ritual_participant_status
  USING status::text::ritual_participant_status;
ALTER TABLE ritual_attendance
  ALTER COLUMN status SET DEFAULT 'confirmed'::ritual_participant_status;

-- 6) Timestamp/default alignment
ALTER TABLE ritual_attendance
  ALTER COLUMN checkin_at TYPE TIMESTAMPTZ USING checkin_at AT TIME ZONE 'UTC',
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN created_at SET DEFAULT NOW();

-- 7) Backfill new columns from existing data
UPDATE ritual_attendance
SET checkin_keyword_ok = true
WHERE checkin_at IS NOT NULL
  AND checkin_keyword_ok IS DISTINCT FROM true;

-- Infer cancellation timing from ritual start
UPDATE ritual_attendance ra
SET cancelled_at = COALESCE(ra.cancelled_at, NOW()),
    cancellation_type = CASE
      WHEN r.start_time IS NOT NULL AND r.start_time - NOW() >= INTERVAL '6 hours' THEN 'early'::ritual_cancellation_type
      ELSE 'late'::ritual_cancellation_type
    END
FROM rituals r
WHERE ra.ritual_id = r.id
  AND ra.status = 'cancelled'
  AND ra.cancellation_type IS NULL;

-- 8) Required indexes by spec
CREATE INDEX IF NOT EXISTS idx_ritual_attendance_ritual_id ON ritual_attendance(ritual_id);
CREATE INDEX IF NOT EXISTS idx_ritual_attendance_user_id ON ritual_attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_ritual_attendance_status ON ritual_attendance(status);
