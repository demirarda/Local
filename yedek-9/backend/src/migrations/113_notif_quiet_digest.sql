-- Absolute 100 B — quiet hours 01:00–09:00 + weekly digest default ON
ALTER TABLE user_settings
  ALTER COLUMN notify_quiet_start SET DEFAULT '01:00',
  ALTER COLUMN notify_quiet_end SET DEFAULT '09:00',
  ALTER COLUMN notify_quiet_hours_enabled SET DEFAULT true;

UPDATE user_settings
SET notify_quiet_start = '01:00',
    notify_quiet_end = '09:00'
WHERE notify_quiet_start = '22:00'
  AND notify_quiet_end = '08:00';

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS notify_weekly_digest BOOLEAN NOT NULL DEFAULT true;
