-- MEGA kalan launch kilitleri: bağ üçlüsü, totem-C, E2 koltuk, BOTH, claim itiraz, waitlist teklif

ALTER TABLE venues
  ADD COLUMN IF NOT EXISTS totem_path TEXT DEFAULT 'STAFF_DEVICE',
  ADD COLUMN IF NOT EXISTS totem_placement_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS both_stamp BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lifecycle_phase TEXT DEFAULT 'active';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'venues_totem_path_chk') THEN
    ALTER TABLE venues
      ADD CONSTRAINT venues_totem_path_chk
      CHECK (totem_path IS NULL OR totem_path IN ('STAFF_DEVICE', 'TAP_POINT', 'FIGUR'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS org_bonds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_kind TEXT NOT NULL,
  org_id UUID NOT NULL,
  user_id UUID NOT NULL,
  bond_kind TEXT NOT NULL,
  title TEXT,
  person_opt_in BOOLEAN NOT NULL DEFAULT false,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT org_bonds_kind_chk CHECK (bond_kind IN ('EKIP', 'REZIDAN', 'MENSUP')),
  CONSTRAINT org_bonds_org_chk CHECK (org_kind IN ('venue', 'brand', 'both'))
);

CREATE UNIQUE INDEX IF NOT EXISTS org_bonds_active_uniq
  ON org_bonds (org_kind, org_id, user_id, bond_kind)
  WHERE ended_at IS NULL;

CREATE TABLE IF NOT EXISTS venue_claim_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ritual_id UUID NOT NULL,
  venue_id UUID NOT NULL,
  host_id UUID,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ritual_event_sub_seals
  ADD COLUMN IF NOT EXISTS seat_price NUMERIC,
  ADD COLUMN IF NOT EXISTS seat_cap INTEGER,
  ADD COLUMN IF NOT EXISTS roof_ticketed BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE ritual_waitlist
  ADD COLUMN IF NOT EXISTS offered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS offer_expires_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS event_ortak_an_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ritual_id UUID NOT NULL,
  kind TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  published_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT event_ortak_an_kind_chk CHECK (kind IN ('quiz', 'poll', 'announce'))
);
