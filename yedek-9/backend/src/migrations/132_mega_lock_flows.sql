-- MEGA kilitli ürün akışları: E6 · V13 · E1 · totem · badge-studio · satışlarım

ALTER TABLE rituals
  ALTER COLUMN host_id DROP NOT NULL;

ALTER TABLE rituals
  ADD COLUMN IF NOT EXISTS host_vacated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rebuilt_from_id UUID,
  ADD COLUMN IF NOT EXISTS bound_host BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS host_role_open BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS ritual_rebuild_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_ritual_id UUID NOT NULL,
  clone_ritual_id UUID,
  mode TEXT NOT NULL,
  created_by UUID,
  claimed_by UUID,
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ritual_rebuild_offers_mode_chk
    CHECK (mode IN ('rebuild_now', 'open_claim'))
);

CREATE INDEX IF NOT EXISTS ritual_rebuild_offers_source
  ON ritual_rebuild_offers (source_ritual_id, created_at DESC);

ALTER TABLE venue_badges
  ADD COLUMN IF NOT EXISTS requirement_text TEXT,
  ADD COLUMN IF NOT EXISTS kind TEXT DEFAULT 'B';

ALTER TABLE ritual_event_sub_seals
  ADD COLUMN IF NOT EXISTS seating_channel TEXT;
