-- LOCAL v2 §10 completion: allow P2Z feedback type for chip routes

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'feedback_feedback_type_check') THEN
    ALTER TABLE feedback DROP CONSTRAINT feedback_feedback_type_check;
  END IF;
END $$;

ALTER TABLE feedback
  ADD CONSTRAINT feedback_feedback_type_check
  CHECK (feedback_type IN ('p2p', 'p2host', 'p2r', 'p2z', 'p2m', 'p2v', 'r1_self'));
