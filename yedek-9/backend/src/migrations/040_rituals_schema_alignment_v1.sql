-- Migration 040: Align rituals with backend-yeni.md §2.4 (rituals)

-- 1) categories (FK target for category_id)
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO categories (name, slug)
SELECT 'Genel', 'genel'
WHERE NOT EXISTS (SELECT 1 FROM categories LIMIT 1);

-- 2) PostGIS (optional; skip if extension unavailable)
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS postgis;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'postgis extension not available; location_geom will be skipped';
END $$;

-- 3) Enum types (doc: open/request/reference, draft/active/live/ended/cancelled)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ritual_entry_type') THEN
    CREATE TYPE ritual_entry_type AS ENUM ('open', 'request', 'reference');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ritual_status') THEN
    CREATE TYPE ritual_status AS ENUM ('draft', 'active', 'live', 'ended', 'cancelled');
  END IF;
END $$;

-- 4) Drop CHECK constraints that block value migration / column drops
ALTER TABLE rituals DROP CONSTRAINT IF EXISTS rituals_entry_type_check;
ALTER TABLE rituals DROP CONSTRAINT IF EXISTS rituals_status_check;
ALTER TABLE rituals DROP CONSTRAINT IF EXISTS chk_min_rs_threshold;

-- 5–6) Normalize legacy VARCHAR values and cast to doc enums (idempotent)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = 'rituals' AND c.column_name = 'entry_type'
      AND c.data_type = 'character varying'
  ) THEN
    UPDATE rituals SET entry_type = 'request' WHERE entry_type = 'request_seat';
    UPDATE rituals SET entry_type = 'reference' WHERE entry_type = 'invite_only';
    ALTER TABLE rituals
      ALTER COLUMN entry_type TYPE ritual_entry_type
      USING entry_type::text::ritual_entry_type;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = 'rituals' AND c.column_name = 'status'
      AND c.data_type = 'character varying'
  ) THEN
    ALTER TABLE rituals ALTER COLUMN status DROP DEFAULT;
    UPDATE rituals SET status = 'active' WHERE status = 'upcoming';
    ALTER TABLE rituals
      ALTER COLUMN status TYPE ritual_status
      USING status::text::ritual_status;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = 'rituals' AND c.column_name = 'status'
      AND c.udt_name = 'ritual_status'
  ) THEN
    ALTER TABLE rituals ALTER COLUMN status SET DEFAULT 'active'::ritual_status;
  END IF;
END $$;

-- 7) Add doc columns (idempotent)
ALTER TABLE rituals
  ADD COLUMN IF NOT EXISTS city_id UUID REFERENCES cities(id),
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id),
  ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS location_address TEXT,
  ADD COLUMN IF NOT EXISTS min_rs DECIMAL(4,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_special_event BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurrence_rule TEXT,
  ADD COLUMN IF NOT EXISTS window_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS participant_count INTEGER DEFAULT 0;

-- 8) Rename legacy columns to doc names
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'rituals' AND column_name = 'venue_name'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'rituals' AND column_name = 'location_name'
  ) THEN
    ALTER TABLE rituals RENAME COLUMN venue_name TO location_name;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'rituals' AND column_name = 'related_hobbies'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'rituals' AND column_name = 'mood_tags'
  ) THEN
    ALTER TABLE rituals RENAME COLUMN related_hobbies TO mood_tags;
  END IF;
END $$;

DROP INDEX IF EXISTS ux_rituals_check_in_keyword_ci;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'rituals' AND column_name = 'check_in_keyword'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'rituals' AND column_name = 'checkin_keyword'
  ) THEN
    ALTER TABLE rituals RENAME COLUMN check_in_keyword TO checkin_keyword;
  END IF;
END $$;

-- 9) Precision: location_lat / location_lng → DECIMAL(9,6)
ALTER TABLE rituals
  ALTER COLUMN location_lat TYPE DECIMAL(9,6) USING ROUND(location_lat::numeric, 6)::decimal(9,6),
  ALTER COLUMN location_lng TYPE DECIMAL(9,6) USING ROUND(location_lng::numeric, 6)::decimal(9,6);

-- 10) min_rs from legacy min_rs_threshold (0–100) → doc scale 0–10
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'rituals' AND column_name = 'min_rs_threshold'
  ) THEN
    UPDATE rituals
    SET min_rs = LEAST(
      10::decimal,
      GREATEST(0::decimal, COALESCE(min_rs_threshold, 0)::decimal / 10.0)
    );
    ALTER TABLE rituals DROP COLUMN min_rs_threshold;
  END IF;
END $$;

ALTER TABLE rituals
  ALTER COLUMN min_rs SET DEFAULT 0;

-- 11) live_window_hours: doc default 12, relax CHECK
ALTER TABLE rituals DROP CONSTRAINT IF EXISTS chk_live_window_hours;
ALTER TABLE rituals DROP CONSTRAINT IF EXISTS chk_live_window_hours_doc;
ALTER TABLE rituals
  ALTER COLUMN live_window_hours SET DEFAULT 12;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_live_window_hours_doc'
  ) THEN
    ALTER TABLE rituals
      ADD CONSTRAINT chk_live_window_hours_doc CHECK (live_window_hours >= 1 AND live_window_hours <= 168);
  END IF;
END $$;

-- 12) Backfill references and computed fields
UPDATE rituals r
SET city_id = u.city_id
FROM users u
WHERE r.host_id = u.id
  AND r.city_id IS NULL
  AND u.city_id IS NOT NULL;

UPDATE rituals r
SET location_address = v.address
FROM venues v
WHERE r.venue_id = v.id
  AND (r.location_address IS NULL OR TRIM(r.location_address) = '')
  AND v.address IS NOT NULL;

UPDATE rituals
SET category_id = (SELECT id FROM categories ORDER BY created_at NULLS LAST LIMIT 1)
WHERE category_id IS NULL;

UPDATE rituals
SET end_time = start_time + (COALESCE(duration, 0) || ' minutes')::interval
WHERE end_time IS NULL AND start_time IS NOT NULL;

UPDATE rituals r
SET participant_count = sub.cnt
FROM (
  SELECT ritual_id, COUNT(*)::integer AS cnt
  FROM ritual_attendance
  WHERE status::text IN ('joined', 'checked_in', 'left_early', 'confirmed')
  GROUP BY ritual_id
) sub
WHERE r.id = sub.ritual_id;

UPDATE rituals
SET window_ends_at = end_time + (COALESCE(live_window_hours, 12) || ' hours')::interval
WHERE end_time IS NOT NULL AND window_ends_at IS NULL;

-- 13) PostGIS geometry column
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'rituals' AND column_name = 'location_geom'
    ) THEN
      ALTER TABLE rituals ADD COLUMN location_geom geometry(Point, 4326);
    END IF;
    UPDATE rituals
    SET location_geom = ST_SetSRID(
      ST_MakePoint(location_lng::double precision, location_lat::double precision),
      4326
    )::geometry(Point, 4326)
    WHERE location_geom IS NULL
      AND location_lat IS NOT NULL
      AND location_lng IS NOT NULL;
  END IF;
END $$;

-- 14) checkin_keyword length per doc
UPDATE rituals
SET checkin_keyword = LEFT(checkin_keyword, 50)
WHERE checkin_keyword IS NOT NULL AND length(checkin_keyword) > 50;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'rituals' AND column_name = 'checkin_keyword'
  ) THEN
    ALTER TABLE rituals
      ALTER COLUMN checkin_keyword TYPE VARCHAR(50);
  END IF;
END $$;

-- 15) created_at → TIMESTAMPTZ NOW()
ALTER TABLE rituals
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN created_at SET DEFAULT NOW();

-- 16) Indexes (§2.4)
CREATE INDEX IF NOT EXISTS idx_rituals_host_id ON rituals(host_id);
CREATE INDEX IF NOT EXISTS idx_rituals_city_id ON rituals(city_id);
CREATE INDEX IF NOT EXISTS idx_rituals_start_time ON rituals(start_time);
CREATE INDEX IF NOT EXISTS idx_rituals_status ON rituals(status);
CREATE INDEX IF NOT EXISTS idx_rituals_min_rs ON rituals(min_rs);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis')
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'rituals' AND column_name = 'location_geom'
     ) THEN
    CREATE INDEX IF NOT EXISTS idx_rituals_location_geom_gist ON rituals USING GIST (location_geom);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_rituals_checkin_keyword_ci
ON rituals (LOWER(TRIM(checkin_keyword)))
WHERE checkin_keyword IS NOT NULL AND TRIM(checkin_keyword) <> '';
