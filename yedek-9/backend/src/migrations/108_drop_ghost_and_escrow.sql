-- 108 — sonMD: Ghost yok · escrow ölü · host ledger / market share tables
-- Ghost column dropped; escrow tables cleaned if present.

ALTER TABLE users DROP COLUMN IF EXISTS ghost_mode;

DROP TABLE IF EXISTS keyword_escrow CASCADE;
DROP TABLE IF EXISTS ritual_keyword_escrow CASCADE;

-- Host private ledger aggregates (HostHistoryScreen)
CREATE TABLE IF NOT EXISTS host_ledger_cache (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  hosted_count INT NOT NULL DEFAULT 0,
  on_time_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  no_show_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  avg_fill_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Venue market-share / city radar snapshots (Hakim panel)
CREATE TABLE IF NOT EXISTS venue_market_share_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  city_id UUID,
  window_days INT NOT NULL DEFAULT 30,
  category_key TEXT,
  city_ritual_count INT NOT NULL DEFAULT 0,
  venue_ritual_count INT NOT NULL DEFAULT 0,
  share_pct NUMERIC(6,2) NOT NULL DEFAULT 0,
  district_breakdown JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_venue_market_share_venue
  ON venue_market_share_snapshots (venue_id, created_at DESC);

-- Package upgrade requests (Stripe fallback)
CREATE TABLE IF NOT EXISTS venue_package_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_tier TEXT,
  to_tier TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'contacted', 'activated', 'cancelled')),
  stripe_session_id TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_venue_package_requests_venue
  ON venue_package_requests (venue_id, created_at DESC);
