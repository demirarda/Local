-- Check-in sonMD kalan boşluklar: C5 totem durumu + ferry ship çapa
ALTER TABLE venues
  ADD COLUMN IF NOT EXISTS totem_status TEXT NOT NULL DEFAULT 'ok';

COMMENT ON COLUMN venues.totem_status IS
  'ok | broken | missing — C5: broken/missing → kod fallback (TOTEM_BROKEN_FALLBACK_TO_CODE)';

ALTER TABLE rituals
  ADD COLUMN IF NOT EXISTS ship_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS ship_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS departure_at TIMESTAMPTZ;

COMMENT ON COLUMN rituals.ship_lat IS 'Ferry/scheduled: kalkış sonrası gemi çapası (yoksa opener GPS)';
COMMENT ON COLUMN rituals.departure_at IS 'Ferry/scheduled: kalkış anı — kapı min(formül, departure+pad)';
