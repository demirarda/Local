-- sonMD Check-In §8 Dört cephe %100
-- C2: bina-yoğun venue radius yıldızı
-- C3: prova saha notları
-- C5: white-glove totem ops kuyruğu (panel talebi artık gerçek satır)

ALTER TABLE venues
  ADD COLUMN IF NOT EXISTS dense_canyon BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gps_radius_m INTEGER;

COMMENT ON COLUMN venues.dense_canyon IS
  '§8 C2 beton kanyon — true ise GPS_RADIUS_METERS.venue_dense (yıldız) uygulanır';
COMMENT ON COLUMN venues.gps_radius_m IS
  '§8 C2 per-venue GPS yarıçap override (m). NULL = tip/dense varsayılanı';

CREATE TABLE IF NOT EXISTS totem_ops_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  requested_by UUID NULL,
  note TEXT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_totem_ops_status_created
  ON totem_ops_queue (status, created_at DESC);

COMMENT ON TABLE totem_ops_queue IS
  '§8 C5 white-glove / yedek totem kuyruğu — queued | dispatched | done | cancelled';

CREATE TABLE IF NOT EXISTS checkin_field_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ritual_id UUID NULL,
  venue_id UUID NULL,
  author_id UUID NULL,
  checklist_key TEXT NOT NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_checkin_field_notes_created
  ON checkin_field_notes (created_at DESC);

COMMENT ON TABLE checkin_field_notes IS
  '§8 C3 / §9 prova saha notları — pivot checklist maddesine bağlı';
