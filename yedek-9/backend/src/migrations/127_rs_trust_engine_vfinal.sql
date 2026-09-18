-- 24 Ağu v-final: FL co-seal, placement/FAR, söz-soğuma, dönüş-hafızası, leave void, P2C

ALTER TABLE friendships
  ADD COLUMN IF NOT EXISTS co_seal_count INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS friendship_co_seals (
  user_a UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ritual_id UUID NOT NULL REFERENCES rituals(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_a, user_b, ritual_id),
  CHECK (user_a < user_b)
);

CREATE INDEX IF NOT EXISTS idx_friendship_co_seals_pair
  ON friendship_co_seals (user_a, user_b, created_at DESC);

ALTER TABLE ritual_attendance
  ADD COLUMN IF NOT EXISTS positive_rs_voided BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS leave_kind TEXT;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS promise_cooled_until TIMESTAMPTZ;

ALTER TABLE identity_hashes
  ADD COLUMN IF NOT EXISTS discipline_rs NUMERIC,
  ADD COLUMN IF NOT EXISTS no_show_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS late_cancel_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE feedback
  ADD COLUMN IF NOT EXISTS chip_id_2 VARCHAR(64);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'feedback_feedback_type_check') THEN
    ALTER TABLE feedback DROP CONSTRAINT feedback_feedback_type_check;
  END IF;
END $$;

ALTER TABLE feedback
  ADD CONSTRAINT feedback_feedback_type_check
  CHECK (feedback_type IN (
    'p2p', 'p2host', 'p2r', 'p2z', 'p2c', 'p2m', 'p2v', 'r1_self', 'rq', 'rq_event'
  ));
