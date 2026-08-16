-- Migration 051: Align badges schema with backend-yeni.md §2.13 (lines 451-470)

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'badge_category') THEN
    CREATE TYPE badge_category AS ENUM ('rs', 'behavior', 'social', 'activity', 'friendship');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(100) UNIQUE,
  name VARCHAR(255),
  description TEXT,
  category badge_category,
  is_friendship_badge BOOLEAN DEFAULT false,
  icon_emoji VARCHAR(10),
  trigger_condition JSONB
);

