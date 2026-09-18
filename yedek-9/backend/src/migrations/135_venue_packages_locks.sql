-- Venue paket kilitleri: çift-dil rozet, duyuru kotası

ALTER TABLE venue_badges
  ADD COLUMN IF NOT EXISTS name_en TEXT,
  ADD COLUMN IF NOT EXISTS name_tr TEXT;

CREATE TABLE IF NOT EXISTS venue_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL,
  created_by UUID,
  body TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS venue_announcements_month
  ON venue_announcements (venue_id, created_at DESC);

ALTER TABLE venue_slots
  ADD COLUMN IF NOT EXISTS self_rez_mode TEXT;
