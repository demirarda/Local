-- LOCAL v2 §2 completion: origin enum + open_note + event sub-seal logs

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ritual_origin_type') THEN
    CREATE TYPE ritual_origin_type AS ENUM ('SLOT_PLANNED', 'WALK_IN', 'VEN_EVENT');
  END IF;
END $$;

ALTER TABLE rituals
  ADD COLUMN IF NOT EXISTS origin ritual_origin_type NOT NULL DEFAULT 'WALK_IN',
  ADD COLUMN IF NOT EXISTS gate_override_until TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS ritual_event_sub_seals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ritual_id UUID NOT NULL REFERENCES rituals(id) ON DELETE CASCADE,
  sub_id VARCHAR(64) NOT NULL,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  in_ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  out_ts TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ritual_event_sub_seals_ritual
  ON ritual_event_sub_seals (ritual_id, sub_id, in_ts DESC);
