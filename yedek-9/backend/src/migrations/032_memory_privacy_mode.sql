-- LTE-3 §4.4: Per-user memory privacy mode
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS memory_privacy_mode VARCHAR(32) DEFAULT 'public';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_user_settings_memory_privacy_mode'
  ) THEN
    ALTER TABLE user_settings
    ADD CONSTRAINT chk_user_settings_memory_privacy_mode
    CHECK (memory_privacy_mode IN ('public', 'friends_only', 'private'));
  END IF;
END $$;

UPDATE user_settings
SET memory_privacy_mode = 'public'
WHERE memory_privacy_mode IS NULL OR TRIM(memory_privacy_mode) = '';
