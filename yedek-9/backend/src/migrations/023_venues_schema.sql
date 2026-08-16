-- Venues System Schema
-- Migration 023: Venues as first-class entities, venue managers, venue follows

-- Venues table (single source of truth for venue identity)
CREATE TABLE IF NOT EXISTS venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  city VARCHAR(100) NOT NULL,
  address TEXT,
  location_lat DECIMAL(10, 8),
  location_lng DECIMAL(11, 8),
  description TEXT,
  slug VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(name, city)
);

-- Venue managers: which users can manage (create rituals for) which venue
CREATE TABLE IF NOT EXISTS venue_managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL DEFAULT 'manager' CHECK (role IN ('owner', 'manager', 'staff')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(venue_id, user_id)
);

-- Venue follows: users can follow venues (for Pulse "followed venue" filter)
CREATE TABLE IF NOT EXISTS venue_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, venue_id)
);

-- Add venue_id to rituals (nullable for backward compatibility)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rituals' AND column_name = 'venue_id'
  ) THEN
    ALTER TABLE rituals ADD COLUMN venue_id UUID REFERENCES venues(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_venues_city ON venues(city);
CREATE INDEX IF NOT EXISTS idx_venues_name ON venues(name);
CREATE INDEX IF NOT EXISTS idx_venue_managers_venue ON venue_managers(venue_id);
CREATE INDEX IF NOT EXISTS idx_venue_managers_user ON venue_managers(user_id);
CREATE INDEX IF NOT EXISTS idx_venue_follows_user ON venue_follows(user_id);
CREATE INDEX IF NOT EXISTS idx_venue_follows_venue ON venue_follows(venue_id);
CREATE INDEX IF NOT EXISTS idx_rituals_venue_id ON rituals(venue_id);

-- Comments
COMMENT ON TABLE venues IS 'Venues as first-class entities; rituals can be linked via venue_id';
COMMENT ON TABLE venue_managers IS 'Users who can create/edit rituals on behalf of a venue';
COMMENT ON TABLE venue_follows IS 'Users following venues for Pulse and notifications';
