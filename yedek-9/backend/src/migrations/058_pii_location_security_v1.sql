-- Migration 058: PII location at-rest encryption support
ALTER TABLE ritual_attendance
  ADD COLUMN IF NOT EXISTS checkin_gps_encrypted TEXT;
