-- LOCAL v2 §12 — venue chains + brands for search/discovery
-- Authority: LOCAL_Cursor_Build_Dokumani_v2-2.md §12

CREATE TABLE IF NOT EXISTS venue_chains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE venues
  ADD COLUMN IF NOT EXISTS chain_id UUID REFERENCES venue_chains(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES brands(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_venues_chain ON venues (chain_id) WHERE chain_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_venues_brand ON venues (brand_id) WHERE brand_id IS NOT NULL;
