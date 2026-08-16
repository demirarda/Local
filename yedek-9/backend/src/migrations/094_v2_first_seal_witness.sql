-- LOCAL v2 §0/#2 — firstSeal model + PENDING_WITNESS + LOCAL-TAG + planners_only
-- Authority: LOCAL_Cursor_Build_Dokumani_v2 final §2

ALTER TABLE rituals
  ADD COLUMN IF NOT EXISTS first_sealed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS first_sealed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS open_note TEXT,
  ADD COLUMN IF NOT EXISTS planners_only BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE ritual_attendance
  ADD COLUMN IF NOT EXISTS checkin_phase VARCHAR(32),
  ADD COLUMN IF NOT EXISTS witness_required INT,
  ADD COLUMN IF NOT EXISTS witness_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS checkin_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS location_suspect BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS ritual_checkin_witnesses (
  ritual_id UUID NOT NULL REFERENCES rituals(id) ON DELETE CASCADE,
  subject_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  witness_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (ritual_id, subject_user_id, witness_user_id)
);

CREATE INDEX IF NOT EXISTS idx_checkin_witness_subject
  ON ritual_checkin_witnesses (ritual_id, subject_user_id);

CREATE TABLE IF NOT EXISTS ritual_local_checkin_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ritual_id UUID NOT NULL REFERENCES rituals(id) ON DELETE CASCADE,
  issuer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  redeemed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  redeemed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_local_checkin_tags_ritual
  ON ritual_local_checkin_tags (ritual_id, expires_at DESC);
