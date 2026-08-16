-- Migration 045: Align feedback table with backend-yeni.md §2.8 feedbacks

-- 1) Enum for friendship level at rating time (doc: l1,l2,l3)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'feedback_friendship_level') THEN
    CREATE TYPE feedback_friendship_level AS ENUM ('l1', 'l2', 'l3');
  END IF;
END $$;

-- 2) Add doc columns
ALTER TABLE feedback
  ADD COLUMN IF NOT EXISTS rater_id UUID REFERENCES users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS ratee_id UUID REFERENCES users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS friendship_level feedback_friendship_level,
  ADD COLUMN IF NOT EXISTS rs_weight DECIMAL(3,2),
  ADD COLUMN IF NOT EXISTS q1_score SMALLINT,
  ADD COLUMN IF NOT EXISTS q2_score SMALLINT,
  ADD COLUMN IF NOT EXISTS p2r_score SMALLINT,
  ADD COLUMN IF NOT EXISTS is_processed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS deadline_at TIMESTAMPTZ;

-- 3) Backfill key IDs from legacy columns
UPDATE feedback
SET rater_id = COALESCE(rater_id, from_user_id),
    ratee_id = COALESCE(ratee_id, to_user_id, from_user_id)
WHERE rater_id IS NULL OR ratee_id IS NULL;

-- 4) Backfill score columns from legacy color fields
UPDATE feedback
SET q1_score = CASE q1_comfort WHEN 'red' THEN 1 WHEN 'yellow' THEN 2 WHEN 'green' THEN 3 ELSE NULL END
WHERE q1_score IS NULL;

UPDATE feedback
SET q2_score = CASE q2_energy WHEN 'red' THEN 1 WHEN 'yellow' THEN 2 WHEN 'green' THEN 3 ELSE NULL END
WHERE q2_score IS NULL;

UPDATE feedback
SET p2r_score = CASE p2r_feeling WHEN 'red' THEN 1 WHEN 'yellow' THEN 2 WHEN 'green' THEN 3 ELSE NULL END
WHERE p2r_score IS NULL;

-- 5) Backfill friendship level + rs_weight from friendships at submit time (best effort)
UPDATE feedback f
SET friendship_level = COALESCE(f.friendship_level, 'l1'::feedback_friendship_level),
    rs_weight = COALESCE(
      f.rs_weight,
      CASE COALESCE(fr.friendship_level::text, 'l1')
        WHEN 'l1' THEN 1.00
        WHEN 'l2' THEN 0.50
        WHEN 'l3' THEN 0.00
        ELSE 1.00
      END
    )
FROM friendships fr
WHERE (
    (fr.requester_id = f.rater_id AND fr.receiver_id = f.ratee_id) OR
    (fr.requester_id = f.ratee_id AND fr.receiver_id = f.rater_id)
  );

UPDATE feedback
SET friendship_level = COALESCE(friendship_level, 'l1'::feedback_friendship_level),
    rs_weight = COALESCE(rs_weight, 1.00);

-- 6) submitted_at / deadline_at
UPDATE feedback
SET submitted_at = COALESCE(submitted_at, created_at AT TIME ZONE 'UTC')
WHERE submitted_at IS NULL;

UPDATE feedback f
SET deadline_at = (r.end_time + INTERVAL '24 hours')
FROM rituals r
WHERE f.ritual_id = r.id
  AND f.deadline_at IS NULL
  AND r.end_time IS NOT NULL;

-- Fallback if end_time unavailable
UPDATE feedback f
SET deadline_at = (r.start_time + (COALESCE(r.duration, 0) || ' minutes')::interval + INTERVAL '24 hours')
FROM rituals r
WHERE f.ritual_id = r.id
  AND f.deadline_at IS NULL
  AND r.start_time IS NOT NULL;

-- 7) Add score checks per doc (1-3)
ALTER TABLE feedback DROP CONSTRAINT IF EXISTS chk_feedback_q1_score_range;
ALTER TABLE feedback DROP CONSTRAINT IF EXISTS chk_feedback_q2_score_range;
ALTER TABLE feedback DROP CONSTRAINT IF EXISTS chk_feedback_p2r_score_range;
ALTER TABLE feedback
  ADD CONSTRAINT chk_feedback_q1_score_range CHECK (q1_score IS NULL OR q1_score BETWEEN 1 AND 3),
  ADD CONSTRAINT chk_feedback_q2_score_range CHECK (q2_score IS NULL OR q2_score BETWEEN 1 AND 3),
  ADD CONSTRAINT chk_feedback_p2r_score_range CHECK (p2r_score IS NULL OR p2r_score BETWEEN 1 AND 3);

-- 8) Ensure IDs are present (doc has rater_id/ratee_id required)
ALTER TABLE feedback
  ALTER COLUMN rater_id SET NOT NULL,
  ALTER COLUMN ratee_id SET NOT NULL;

-- 9) Unique index per doc
CREATE UNIQUE INDEX IF NOT EXISTS ux_feedback_ritual_rater_ratee
ON feedback (ritual_id, rater_id, ratee_id);

-- 10) Keep legacy and doc columns synchronized
CREATE OR REPLACE FUNCTION sync_feedback_columns()
RETURNS TRIGGER AS $$
BEGIN
  -- IDs
  IF NEW.rater_id IS NULL AND NEW.from_user_id IS NOT NULL THEN NEW.rater_id := NEW.from_user_id; END IF;
  IF NEW.ratee_id IS NULL THEN NEW.ratee_id := COALESCE(NEW.to_user_id, NEW.rater_id, NEW.from_user_id); END IF;
  IF NEW.from_user_id IS NULL AND NEW.rater_id IS NOT NULL THEN NEW.from_user_id := NEW.rater_id; END IF;
  IF NEW.to_user_id IS NULL AND NEW.ratee_id IS NOT NULL AND NEW.feedback_type IN ('p2p','p2host') THEN NEW.to_user_id := NEW.ratee_id; END IF;

  -- Score/color mappings
  IF NEW.q1_score IS NULL AND NEW.q1_comfort IS NOT NULL THEN
    NEW.q1_score := CASE NEW.q1_comfort WHEN 'red' THEN 1 WHEN 'yellow' THEN 2 WHEN 'green' THEN 3 ELSE NULL END;
  END IF;
  IF NEW.q2_score IS NULL AND NEW.q2_energy IS NOT NULL THEN
    NEW.q2_score := CASE NEW.q2_energy WHEN 'red' THEN 1 WHEN 'yellow' THEN 2 WHEN 'green' THEN 3 ELSE NULL END;
  END IF;
  IF NEW.p2r_score IS NULL AND NEW.p2r_feeling IS NOT NULL THEN
    NEW.p2r_score := CASE NEW.p2r_feeling WHEN 'red' THEN 1 WHEN 'yellow' THEN 2 WHEN 'green' THEN 3 ELSE NULL END;
  END IF;

  IF NEW.q1_comfort IS NULL AND NEW.q1_score IS NOT NULL THEN
    NEW.q1_comfort := CASE NEW.q1_score WHEN 1 THEN 'red' WHEN 2 THEN 'yellow' WHEN 3 THEN 'green' ELSE NULL END;
  END IF;
  IF NEW.q2_energy IS NULL AND NEW.q2_score IS NOT NULL THEN
    NEW.q2_energy := CASE NEW.q2_score WHEN 1 THEN 'red' WHEN 2 THEN 'yellow' WHEN 3 THEN 'green' ELSE NULL END;
  END IF;
  IF NEW.p2r_feeling IS NULL AND NEW.p2r_score IS NOT NULL THEN
    NEW.p2r_feeling := CASE NEW.p2r_score WHEN 1 THEN 'red' WHEN 2 THEN 'yellow' WHEN 3 THEN 'green' ELSE NULL END;
  END IF;

  -- submitted_at mirrors created_at for compatibility
  IF NEW.submitted_at IS NULL THEN NEW.submitted_at := COALESCE(NEW.created_at, NOW()); END IF;
  IF NEW.created_at IS NULL THEN NEW.created_at := NEW.submitted_at; END IF;

  -- defaults for doc-only fields
  IF NEW.friendship_level IS NULL THEN NEW.friendship_level := 'l1'::feedback_friendship_level; END IF;
  IF NEW.rs_weight IS NULL THEN
    NEW.rs_weight := CASE NEW.friendship_level WHEN 'l1' THEN 1.00 WHEN 'l2' THEN 0.50 WHEN 'l3' THEN 0.00 ELSE 1.00 END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_feedback_columns ON feedback;
CREATE TRIGGER trg_sync_feedback_columns
BEFORE INSERT OR UPDATE ON feedback
FOR EACH ROW
EXECUTE FUNCTION sync_feedback_columns();

-- 11) Constraint trigger: rater and ratee must both be participants of same ritual
CREATE OR REPLACE FUNCTION enforce_feedback_same_ritual_participants()
RETURNS TRIGGER AS $$
DECLARE
  rater_ok BOOLEAN;
  ratee_ok BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM ritual_attendance ra
    WHERE ra.ritual_id = NEW.ritual_id AND ra.user_id = NEW.rater_id
  ) INTO rater_ok;

  SELECT EXISTS(
    SELECT 1 FROM ritual_attendance ra
    WHERE ra.ritual_id = NEW.ritual_id AND ra.user_id = NEW.ratee_id
  ) INTO ratee_ok;

  IF NOT rater_ok OR NOT ratee_ok THEN
    RAISE EXCEPTION 'rater_id and ratee_id must be participants of ritual %', NEW.ritual_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_feedback_same_ritual_participants ON feedback;
CREATE TRIGGER trg_feedback_same_ritual_participants
BEFORE INSERT OR UPDATE ON feedback
FOR EACH ROW
EXECUTE FUNCTION enforce_feedback_same_ritual_participants();

