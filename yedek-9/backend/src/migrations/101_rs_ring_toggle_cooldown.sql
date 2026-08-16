-- sonMD E3.5 — RS halka opt-in: 30g toggle cooldown + tamamlanmış ritüel eşiği
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS show_rs_toggled_at TIMESTAMPTZ;

COMMENT ON COLUMN user_settings.show_rs_toggled_at IS
  'Last time show_rs_score_publicly changed; toggle cooldown = rs.visibility.TOGGLE_DAYS';
