-- Migration 037: Align users schema with backend-yeni.md (2.1 users)
-- Non-destructive approach: keep legacy columns (name/city/university) for compatibility.

-- 1) Reference tables required by users FK columns
CREATE TABLE IF NOT EXISTS universities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2) Enum type for memory privacy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'memory_privacy_enum'
  ) THEN
    CREATE TYPE memory_privacy_enum AS ENUM ('public', 'friends', 'private');
  END IF;
END $$;

-- 3) Align users table columns to doc
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS university_id UUID REFERENCES universities(id),
  ADD COLUMN IF NOT EXISTS first_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS last_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS city_id UUID REFERENCES cities(id),
  ADD COLUMN IF NOT EXISTS rs_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS total_rituals INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_hosted INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_pivot_host BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_verified_host BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS memory_privacy memory_privacy_enum DEFAULT 'friends',
  ADD COLUMN IF NOT EXISTS notification_prefs JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS ds_score DECIMAL(4,2) DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS ds_ema DECIMAL(4,2) DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 4) Keep rs_score compatible with doc precision/default
ALTER TABLE users
  ALTER COLUMN rs_score TYPE DECIMAL(4,2) USING rs_score::DECIMAL(4,2),
  ALTER COLUMN rs_score SET DEFAULT 5.0;

-- 5) Align created_at to TIMESTAMPTZ + NOW()
ALTER TABLE users
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN created_at SET DEFAULT NOW();

-- 6) Backfill reference data from legacy string columns
INSERT INTO universities (name)
SELECT DISTINCT TRIM(university)
FROM users
WHERE university IS NOT NULL AND TRIM(university) <> ''
ON CONFLICT (name) DO NOTHING;

INSERT INTO cities (name)
SELECT DISTINCT TRIM(city)
FROM users
WHERE city IS NOT NULL AND TRIM(city) <> ''
ON CONFLICT (name) DO NOTHING;

UPDATE users u
SET university_id = univ.id
FROM universities univ
WHERE u.university_id IS NULL
  AND u.university IS NOT NULL
  AND TRIM(u.university) <> ''
  AND univ.name = TRIM(u.university);

UPDATE users u
SET city_id = c.id
FROM cities c
WHERE u.city_id IS NULL
  AND u.city IS NOT NULL
  AND TRIM(u.city) <> ''
  AND c.name = TRIM(u.city);

-- 7) Backfill first_name / last_name from legacy name
UPDATE users
SET
  first_name = COALESCE(first_name, split_part(TRIM(name), ' ', 1)),
  last_name = COALESCE(
    last_name,
    NULLIF(
      TRIM(
        regexp_replace(
          TRIM(name),
          '^\S+\s*',
          ''
        )
      ),
      ''
    )
  )
WHERE name IS NOT NULL
  AND TRIM(name) <> '';

-- 8) rs_updated_at default/backfill
UPDATE users
SET rs_updated_at = COALESCE(rs_updated_at, created_at)
WHERE rs_updated_at IS NULL;

-- 9) totals backfill
UPDATE users u
SET total_rituals = COALESCE(stats.cnt, 0)
FROM (
  SELECT user_id, COUNT(*)::int AS cnt
  FROM ritual_attendance
  WHERE status NOT IN ('no_show', 'cancelled')
  GROUP BY user_id
) stats
WHERE u.id = stats.user_id;

UPDATE users
SET total_rituals = COALESCE(total_rituals, 0)
WHERE total_rituals IS NULL;

UPDATE users u
SET total_hosted = COALESCE(stats.cnt, 0)
FROM (
  SELECT host_id, COUNT(*)::int AS cnt
  FROM rituals
  GROUP BY host_id
) stats
WHERE u.id = stats.host_id;

UPDATE users
SET total_hosted = COALESCE(total_hosted, 0)
WHERE total_hosted IS NULL;

-- 10) host verification flags (if host_verifications exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'host_verifications'
  ) THEN
    UPDATE users u
    SET is_verified_host = true
    WHERE EXISTS (
      SELECT 1
      FROM host_verifications hv
      WHERE hv.user_id = u.id
        AND hv.status = 'active'
        AND (hv.expires_at IS NULL OR hv.expires_at > CURRENT_TIMESTAMP)
    );

    UPDATE users u
    SET is_pivot_host = true
    WHERE EXISTS (
      SELECT 1
      FROM host_verifications hv
      WHERE hv.user_id = u.id
        AND hv.status = 'active'
        AND hv.verification_type = 'premium'
        AND (hv.expires_at IS NULL OR hv.expires_at > CURRENT_TIMESTAMP)
    );
  END IF;
END $$;

-- 11) indexes for new FK and soft delete usage
CREATE INDEX IF NOT EXISTS idx_users_university_id ON users(university_id);
CREATE INDEX IF NOT EXISTS idx_users_city_id ON users(city_id);
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at);
