-- Migration 014: Add 'cancelled' status to ritual_attendance
-- This allows tracking of cancelled attendance for RS penalty calculation

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ritual_attendance'
      AND column_name = 'status'
      AND data_type = 'character varying'
  ) THEN
    ALTER TABLE ritual_attendance
    DROP CONSTRAINT IF EXISTS ritual_attendance_status_check;

    ALTER TABLE ritual_attendance
    ADD CONSTRAINT ritual_attendance_status_check
    CHECK (status IN ('joined', 'checked_in', 'left_early', 'no_show', 'cancelled'));
  END IF;
END $$;
