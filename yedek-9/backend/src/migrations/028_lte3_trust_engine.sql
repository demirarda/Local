-- LTE-3 Trust Engine: bypass state, RS history detail columns, ritual check-in keyword, default RS 5.0

CREATE TABLE IF NOT EXISTS user_rs_bypass_state (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  no_show_count INTEGER NOT NULL DEFAULT 0,
  late_cancel_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_rs_bypass_state_user ON user_rs_bypass_state(user_id);

ALTER TABLE users
  ALTER COLUMN rs_score SET DEFAULT 5.0;

ALTER TABLE rituals
  ADD COLUMN IF NOT EXISTS check_in_keyword VARCHAR(100);

COMMENT ON COLUMN rituals.check_in_keyword IS 'Host-set keyword for GPS+keyword check-in (LTE-3 §8)';

ALTER TABLE rs_delta_history
  ADD COLUMN IF NOT EXISTS s_r DECIMAL(6,4),
  ADD COLUMN IF NOT EXISTS delta_cap DECIMAL(6,4),
  ADD COLUMN IF NOT EXISTS ds_mult DECIMAL(6,4),
  ADD COLUMN IF NOT EXISTS n_context_frozen BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS bc5_trend DECIMAL(6,4),
  ADD COLUMN IF NOT EXISTS bc5_mult DECIMAL(6,4),
  ADD COLUMN IF NOT EXISTS md_mult DECIMAL(6,4),
  ADD COLUMN IF NOT EXISTS br_mult DECIMAL(6,4),
  ADD COLUMN IF NOT EXISTS delta_after_ds DECIMAL(6,4),
  ADD COLUMN IF NOT EXISTS pipeline_kind VARCHAR(24),
  ADD COLUMN IF NOT EXISTS bypass_reason VARCHAR(32);

COMMENT ON COLUMN rs_delta_history.pipeline_kind IS 'lte3_normal | lte3_bypass | lte3_n_context_frozen';
