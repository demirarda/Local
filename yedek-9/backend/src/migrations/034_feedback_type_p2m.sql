-- 7.1 Venue RS: add native P2M feedback type
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'feedback_feedback_type_check'
  ) THEN
    ALTER TABLE feedback DROP CONSTRAINT feedback_feedback_type_check;
  END IF;
END $$;

ALTER TABLE feedback
ADD CONSTRAINT feedback_feedback_type_check
CHECK (feedback_type IN ('p2p', 'p2host', 'p2r', 'p2m'));
