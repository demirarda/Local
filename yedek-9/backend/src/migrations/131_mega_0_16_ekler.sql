-- MEGA §14-16 + EK-26/27 kilitler

ALTER TABLE venues
  ADD COLUMN IF NOT EXISTS regular_min_seals INTEGER,
  ADD COLUMN IF NOT EXISTS door_policy TEXT DEFAULT 'WALKIN_OPEN',
  ADD COLUMN IF NOT EXISTS totem_mode TEXT DEFAULT 'NFC';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'venues_door_policy_chk'
  ) THEN
    ALTER TABLE venues
      ADD CONSTRAINT venues_door_policy_chk
      CHECK (door_policy IS NULL OR door_policy IN ('WALKIN_OPEN', 'SHELF_ONLY'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'venues_totem_mode_chk'
  ) THEN
    ALTER TABLE venues
      ADD CONSTRAINT venues_totem_mode_chk
      CHECK (totem_mode IS NULL OR totem_mode IN ('NFC', 'ROTATING_CODE'));
  END IF;
END $$;

ALTER TABLE rituals
  ADD COLUMN IF NOT EXISTS door TEXT,
  ADD COLUMN IF NOT EXISTS host_role_open BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS window_farewell BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS life_joker_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  ritual_id UUID,
  consumed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS life_joker_events_user_ts
  ON life_joker_events (user_id, consumed_at DESC);

ALTER TABLE ritual_attendance
  ADD COLUMN IF NOT EXISTS window_left_at TIMESTAMPTZ;
