-- FB-soru-ağacı: S (seller) · VR (ops-notu) tipleri

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'feedback_feedback_type_check') THEN
    ALTER TABLE feedback DROP CONSTRAINT feedback_feedback_type_check;
  END IF;
END $$;

ALTER TABLE feedback
  ADD CONSTRAINT feedback_feedback_type_check
  CHECK (feedback_type IN (
    'p2p', 'p2host', 'p2r', 'p2z', 'p2c', 'p2m', 'p2v', 'r1_self', 'rq', 'rq_event', 'p2s', 'vr'
  ));

ALTER TABLE feedback
  ADD COLUMN IF NOT EXISTS chip_q2_id VARCHAR(64);

ALTER TABLE feedback
  ADD COLUMN IF NOT EXISTS chip_q2_id_2 VARCHAR(64);

COMMENT ON CONSTRAINT feedback_feedback_type_check ON feedback IS
  'FB-ağacı: p2s=seller sicil · vr=mekan→masa ops-notu (RS/Trust dışı)';
