-- 104 — UNDER_MIN · find_note · venue_portals · active_city (sonMD launch P1)
ALTER TABLE rituals
  ADD COLUMN IF NOT EXISTS under_min BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS find_note VARCHAR(60);

COMMENT ON COLUMN rituals.under_min IS
  'seal_count < min → private window only; RS/FB/Regular/badge/LW izolasyonu';
COMMENT ON COLUMN rituals.find_note IS
  '≤60ch masa bulma notu; pre-lock creator, canlı sealed, door-close readonly';

CREATE INDEX IF NOT EXISTS idx_rituals_under_min
  ON rituals (under_min)
  WHERE under_min = true;

-- cities status ACTIVE|COMING
ALTER TABLE cities
  ADD COLUMN IF NOT EXISTS status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_cities_status'
  ) THEN
    ALTER TABLE cities
      ADD CONSTRAINT chk_cities_status
      CHECK (status IN ('ACTIVE', 'COMING'));
  END IF;
END $$;

-- users.active_city_id (gezgin modu)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS active_city_id UUID REFERENCES cities(id);

UPDATE users u
SET active_city_id = u.city_id
WHERE u.active_city_id IS NULL AND u.city_id IS NOT NULL;

-- venue portals (buradasın totem seti)
CREATE TABLE IF NOT EXISTS venue_portals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  portal_id VARCHAR(64) NOT NULL,
  label VARCHAR(80),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (venue_id, portal_id)
);

CREATE INDEX IF NOT EXISTS idx_venue_portals_venue
  ON venue_portals (venue_id);

COMMENT ON TABLE venue_portals IS
  'sonMD: hepsi aynı buradasın-modunu açar; label yalnız multi_room_flag';

ALTER TABLE venues
  ADD COLUMN IF NOT EXISTS multi_room_flag BOOLEAN NOT NULL DEFAULT false;
