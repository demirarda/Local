-- Migration: Add attendance_percentage column to ritual_attendance table
-- This column stores the percentage of ritual duration that the user attended
-- Used for calculating early leave penalties (Spec 9)

ALTER TABLE ritual_attendance
ADD COLUMN IF NOT EXISTS attendance_percentage INTEGER;

-- Add comment
COMMENT ON COLUMN ritual_attendance.attendance_percentage IS 'Percentage of ritual duration attended (0-100). Used for early leave penalty calculation.';
