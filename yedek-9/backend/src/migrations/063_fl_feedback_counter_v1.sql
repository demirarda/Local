-- Migration 063: FL feedback counter (son-part.md §4.2)

ALTER TABLE friendships
  ADD COLUMN IF NOT EXISTS fb_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_feedback_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_feedback_at TIMESTAMPTZ;

-- Backfill fb_count from fresh peer feedback (12 months)
UPDATE friendships f
SET fb_count = sub.c,
    last_feedback_at = sub.last_at,
    first_feedback_at = COALESCE(f.first_feedback_at, sub.first_at),
    friendship_level = (
      CASE
        WHEN sub.c >= 8 THEN 'l3'
        WHEN sub.c >= 4 THEN 'l2'
        WHEN sub.c >= 1 THEN 'l1'
        ELSE 'stranger'
      END
    )::friendship_level_enum
FROM (
  SELECT
    fr.id AS friendship_id,
    COUNT(fb.id)::int AS c,
    MIN(fb.created_at) AS first_at,
    MAX(fb.created_at) AS last_at
  FROM friendships fr
  LEFT JOIN feedback fb
    ON fb.feedback_type IN ('p2p', 'p2host')
   AND fb.created_at >= NOW() - INTERVAL '12 months'
   AND (
     (fb.from_user_id = fr.requester_id AND fb.to_user_id = fr.receiver_id)
     OR (fb.from_user_id = fr.receiver_id AND fb.to_user_id = fr.requester_id)
   )
  WHERE fr.status = 'accepted'
  GROUP BY fr.id
) sub
WHERE f.id = sub.friendship_id;

CREATE INDEX IF NOT EXISTS idx_feedback_pair_fresh
  ON feedback (from_user_id, to_user_id, created_at)
  WHERE feedback_type IN ('p2p', 'p2host');
