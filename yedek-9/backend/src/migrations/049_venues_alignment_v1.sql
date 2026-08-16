-- Migration 049: Align venues schema with backend-yeni.md §2.11

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'venue_badge_tier') THEN
    CREATE TYPE venue_badge_tier AS ENUM ('none', 'community', 'trusted', 'hq');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'venue_subscription_tier') THEN
    CREATE TYPE venue_subscription_tier AS ENUM ('basic', 'pro', 'city_partner');
  END IF;
END $$;

ALTER TABLE venues
  ADD COLUMN IF NOT EXISTS city_id UUID REFERENCES cities(id),
  ADD COLUMN IF NOT EXISTS location_geom geometry(Point, 4326),
  ADD COLUMN IF NOT EXISTS venue_rs DECIMAL(4,2) DEFAULT 5.0,
  ADD COLUMN IF NOT EXISTS rs_rating_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS badge_tier venue_badge_tier DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS total_rituals INTEGER DEFAULT 0;

-- Existing subscription_tier was VARCHAR in previous schema.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'venues'
      AND column_name = 'subscription_tier'
      AND data_type = 'character varying'
  ) THEN
    ALTER TABLE venues
      ALTER COLUMN subscription_tier DROP DEFAULT;

    UPDATE venues
    SET subscription_tier = CASE
      WHEN subscription_tier IN ('free', 'basic') THEN 'basic'
      WHEN subscription_tier = 'pro' THEN 'pro'
      WHEN subscription_tier IN ('city_partner', 'partner') THEN 'city_partner'
      ELSE 'basic'
    END
    WHERE subscription_tier IS NOT NULL;

    ALTER TABLE venues
      ALTER COLUMN subscription_tier TYPE venue_subscription_tier
      USING COALESCE(subscription_tier, 'basic')::venue_subscription_tier;
  END IF;

  ALTER TABLE venues
    ALTER COLUMN subscription_tier SET DEFAULT 'basic'::venue_subscription_tier;
END $$;

-- Backfill city_id from existing city text
UPDATE venues v
SET city_id = c.id
FROM cities c
WHERE v.city_id IS NULL
  AND v.city IS NOT NULL
  AND LOWER(TRIM(v.city)) = LOWER(TRIM(c.name));

-- Geometry backfill if PostGIS exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') THEN
    UPDATE venues
    SET location_geom = ST_SetSRID(
      ST_MakePoint(location_lng::double precision, location_lat::double precision),
      4326
    )::geometry(Point, 4326)
    WHERE location_geom IS NULL
      AND location_lat IS NOT NULL
      AND location_lng IS NOT NULL;
  END IF;
END $$;

-- Precision + timestamp alignment
ALTER TABLE venues
  ALTER COLUMN location_lat TYPE DECIMAL(9,6) USING ROUND(location_lat::numeric, 6)::decimal(9,6),
  ALTER COLUMN location_lng TYPE DECIMAL(9,6) USING ROUND(location_lng::numeric, 6)::decimal(9,6),
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN created_at SET DEFAULT NOW();

-- Backfill aggregate fields
UPDATE venues v
SET total_rituals = sub.cnt
FROM (
  SELECT venue_id, COUNT(*)::int AS cnt
  FROM rituals
  WHERE venue_id IS NOT NULL
  GROUP BY venue_id
) sub
WHERE v.id = sub.venue_id;

-- Keep compatibility boolean flags with enum tier
UPDATE venues
SET pro_enabled = (subscription_tier = 'pro'),
    city_partner_enabled = (subscription_tier = 'city_partner');

-- Keep is_verified synced from venue_verifications
UPDATE venues v
SET is_verified = EXISTS (
  SELECT 1
  FROM venue_verifications vv
  WHERE vv.venue_name = v.name
    AND vv.city = v.city
    AND vv.status = 'active'
    AND (vv.expires_at IS NULL OR vv.expires_at > CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_venues_city_id ON venues(city_id);
CREATE INDEX IF NOT EXISTS idx_venues_subscription_tier ON venues(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_venues_badge_tier ON venues(badge_tier);
CREATE INDEX IF NOT EXISTS idx_venues_owner_user_id ON venues(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_venues_is_verified ON venues(is_verified);
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') THEN
    CREATE INDEX IF NOT EXISTS idx_venues_location_geom_gist ON venues USING GIST (location_geom);
  END IF;
END $$;

