-- §2C VENUE-LEAD RADARI — aynı custom-pin N tekrar → ops lead
-- Config: leads.REPEAT_PIN_N:3

CREATE TABLE IF NOT EXISTS venue_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_key TEXT NOT NULL UNIQUE,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  repeat_count INT NOT NULL DEFAULT 0,
  threshold_n INT NOT NULL DEFAULT 3,
  radius_m INT NOT NULL DEFAULT 30,
  window_d INT NOT NULL DEFAULT 90,
  ritual_ids UUID[] NOT NULL DEFAULT '{}',
  host_ids UUID[] NOT NULL DEFAULT '{}',
  city TEXT,
  last_ritual_id UUID REFERENCES rituals(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'contacted', 'converted', 'closed')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_venue_leads_status_updated
  ON venue_leads (status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_venue_leads_geo
  ON venue_leads (lat, lng);
