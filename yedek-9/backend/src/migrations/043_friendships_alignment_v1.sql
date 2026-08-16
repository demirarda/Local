-- Migration 043: Align friendships schema with backend-yeni.md §2.6

-- 1) Enum types required by spec
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'friendship_status') THEN
    CREATE TYPE friendship_status AS ENUM ('pending', 'accepted', 'declined', 'blocked');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'friendship_level_enum') THEN
    CREATE TYPE friendship_level_enum AS ENUM ('stranger', 'l1', 'l2', 'l3');
  END IF;
END $$;

-- 2) Add spec columns
ALTER TABLE friendships
  ADD COLUMN IF NOT EXISTS requester_id UUID,
  ADD COLUMN IF NOT EXISTS receiver_id UUID,
  ADD COLUMN IF NOT EXISTS shared_ritual_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS friendship_level friendship_level_enum DEFAULT 'l1',
  ADD COLUMN IF NOT EXISTS first_ritual_id UUID REFERENCES rituals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;

-- 3) Backfill requester/receiver from legacy columns
UPDATE friendships
SET requester_id = COALESCE(requester_id, user_id),
    receiver_id = COALESCE(receiver_id, friend_id);

-- 4) Add FK + NOT NULL on new columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_friendships_requester'
  ) THEN
    ALTER TABLE friendships
      ADD CONSTRAINT fk_friendships_requester
      FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_friendships_receiver'
  ) THEN
    ALTER TABLE friendships
      ADD CONSTRAINT fk_friendships_receiver
      FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE friendships
  ALTER COLUMN requester_id SET NOT NULL,
  ALTER COLUMN receiver_id SET NOT NULL;

-- 5) Status to enum
ALTER TABLE friendships DROP CONSTRAINT IF EXISTS friendships_status_check;
ALTER TABLE friendships ALTER COLUMN status DROP DEFAULT;
ALTER TABLE friendships
  ALTER COLUMN status TYPE friendship_status
  USING status::text::friendship_status;
ALTER TABLE friendships
  ALTER COLUMN status SET DEFAULT 'pending'::friendship_status;

-- 6) accepted_at backfill + created_at alignment
UPDATE friendships
SET accepted_at = COALESCE(accepted_at, NOW())
WHERE status = 'accepted'::friendship_status AND accepted_at IS NULL;

ALTER TABLE friendships
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN created_at SET DEFAULT NOW();

-- 7) Keep legacy and new columns synchronized for compatibility
CREATE OR REPLACE FUNCTION sync_friendships_columns()
RETURNS TRIGGER AS $$
BEGIN
  -- Forward fill new doc columns from legacy writes
  IF NEW.requester_id IS NULL AND NEW.user_id IS NOT NULL THEN
    NEW.requester_id := NEW.user_id;
  END IF;
  IF NEW.receiver_id IS NULL AND NEW.friend_id IS NOT NULL THEN
    NEW.receiver_id := NEW.friend_id;
  END IF;

  -- Backfill legacy columns from new writes
  IF NEW.user_id IS NULL AND NEW.requester_id IS NOT NULL THEN
    NEW.user_id := NEW.requester_id;
  END IF;
  IF NEW.friend_id IS NULL AND NEW.receiver_id IS NOT NULL THEN
    NEW.friend_id := NEW.receiver_id;
  END IF;

  IF NEW.status = 'accepted'::friendship_status AND NEW.accepted_at IS NULL THEN
    NEW.accepted_at := NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_friendships_columns ON friendships;
CREATE TRIGGER trg_sync_friendships_columns
BEFORE INSERT OR UPDATE ON friendships
FOR EACH ROW
EXECUTE FUNCTION sync_friendships_columns();

-- 8) Unique + indexes required by spec
CREATE UNIQUE INDEX IF NOT EXISTS ux_friendships_requester_receiver
ON friendships (requester_id, receiver_id);

CREATE INDEX IF NOT EXISTS idx_friendships_requester_id ON friendships(requester_id);
CREATE INDEX IF NOT EXISTS idx_friendships_receiver_id ON friendships(receiver_id);
CREATE INDEX IF NOT EXISTS idx_friendships_status ON friendships(status);
CREATE INDEX IF NOT EXISTS idx_friendships_friendship_level ON friendships(friendship_level);

