-- 24 Ağu v-final gaps: R1-vs-RQ kalibrasyon logu (skora sıfır etki)

CREATE TABLE IF NOT EXISTS rater_calibration_log (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ritual_id UUID NOT NULL REFERENCES rituals(id) ON DELETE CASCADE,
  r1_value NUMERIC,
  rq_value NUMERIC,
  delta NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, ritual_id)
);

CREATE INDEX IF NOT EXISTS idx_rater_calibration_user
  ON rater_calibration_log (user_id, created_at DESC);
