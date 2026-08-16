-- Migration 039: Align cities schema with backend-yeni.md (2.3 cities)

ALTER TABLE cities
  ADD COLUMN IF NOT EXISTS country VARCHAR(100),
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS launch_date DATE,
  ADD COLUMN IF NOT EXISTS timezone VARCHAR(50),
  ADD COLUMN IF NOT EXISTS center_lat DECIMAL(9,6),
  ADD COLUMN IF NOT EXISTS center_lng DECIMAL(9,6);

-- Keep created_at aligned as TIMESTAMPTZ NOW()
ALTER TABLE cities
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN created_at SET DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_cities_is_active ON cities(is_active);
CREATE INDEX IF NOT EXISTS idx_cities_country ON cities(country);
