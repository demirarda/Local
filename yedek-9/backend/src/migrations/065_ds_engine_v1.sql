-- Adım 8: DS motoru — son-part.md §6
ALTER TABLE user_diversity_state
  ADD COLUMN IF NOT EXISTS ds_raw DECIMAL(5,4),
  ADD COLUMN IF NOT EXISTS ds_full DECIMAL(5,4),
  ADD COLUMN IF NOT EXISTS ds_full_ema DECIMAL(5,4),
  ADD COLUMN IF NOT EXISTS ds_tier VARCHAR(24),
  ADD COLUMN IF NOT EXISTS ds_multiplier DECIMAL(5,4),
  ADD COLUMN IF NOT EXISTS pd_score DECIMAL(5,4),
  ADD COLUMN IF NOT EXISTS ctxd_score DECIMAL(5,4),
  ADD COLUMN IF NOT EXISTS vd_score DECIMAL(5,4),
  ADD COLUMN IF NOT EXISTS last_ritual_id UUID;

COMMENT ON COLUMN user_diversity_state.ds_full IS 'DS_full private radar score (FL-weighted)';
COMMENT ON COLUMN user_diversity_state.ds_tier IS 'homebody|familiar|explorer|wanderer|voyager';
