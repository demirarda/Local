-- Migration 052: Align user_badges schema with backend-yeni.md §2.14 (lines 472-491)

ALTER TABLE user_badges
  ADD COLUMN IF NOT EXISTS badge_id UUID REFERENCES badges(id),
  ADD COLUMN IF NOT EXISTS partner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS progress_value INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS target_value INTEGER,
  ADD COLUMN IF NOT EXISTS earned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ritual_id UUID REFERENCES rituals(id) ON DELETE SET NULL;

-- Backfill canonical columns from legacy shape
UPDATE user_badges
SET earned_at = awarded_at AT TIME ZONE 'UTC'
WHERE earned_at IS NULL
  AND awarded_at IS NOT NULL;

UPDATE user_badges
SET ritual_id = source_ritual_id
WHERE ritual_id IS NULL
  AND source_ritual_id IS NOT NULL;

-- Ensure each legacy badge_key has a matching badges row
INSERT INTO badges (slug, name, description, category, is_friendship_badge, icon_emoji, trigger_condition)
SELECT DISTINCT
  ub.badge_key AS slug,
  COALESCE(NULLIF(TRIM(ub.badge_label), ''), ub.badge_key) AS name,
  NULL::text,
  'social'::badge_category,
  false,
  NULL::varchar(10),
  NULL::jsonb
FROM user_badges ub
LEFT JOIN badges b ON b.slug = ub.badge_key
WHERE ub.badge_key IS NOT NULL
  AND b.id IS NULL;

UPDATE user_badges ub
SET badge_id = b.id
FROM badges b
WHERE ub.badge_id IS NULL
  AND ub.badge_key IS NOT NULL
  AND b.slug = ub.badge_key;

ALTER TABLE user_badges
  ALTER COLUMN user_id SET NOT NULL,
  ALTER COLUMN badge_id SET NOT NULL;

-- Keep new and old columns synchronized for compatibility
CREATE OR REPLACE FUNCTION trg_sync_user_badges_columns()
RETURNS TRIGGER AS $$
DECLARE
  v_badge RECORD;
BEGIN
  IF NEW.earned_at IS NULL AND NEW.awarded_at IS NOT NULL THEN
    NEW.earned_at := NEW.awarded_at AT TIME ZONE 'UTC';
  END IF;
  IF NEW.awarded_at IS NULL AND NEW.earned_at IS NOT NULL THEN
    NEW.awarded_at := NEW.earned_at AT TIME ZONE 'UTC';
  END IF;

  IF NEW.ritual_id IS NULL AND NEW.source_ritual_id IS NOT NULL THEN
    NEW.ritual_id := NEW.source_ritual_id;
  END IF;
  IF NEW.source_ritual_id IS NULL AND NEW.ritual_id IS NOT NULL THEN
    NEW.source_ritual_id := NEW.ritual_id;
  END IF;

  IF NEW.badge_id IS NULL AND NEW.badge_key IS NOT NULL THEN
    SELECT id, slug, name INTO v_badge
    FROM badges
    WHERE slug = NEW.badge_key
    LIMIT 1;

    IF v_badge.id IS NULL THEN
      INSERT INTO badges (slug, name, category, is_friendship_badge)
      VALUES (
        NEW.badge_key,
        COALESCE(NULLIF(TRIM(NEW.badge_label), ''), NEW.badge_key),
        'social'::badge_category,
        false
      )
      RETURNING id, slug, name INTO v_badge;
    END IF;

    NEW.badge_id := v_badge.id;
    IF NEW.badge_label IS NULL OR TRIM(NEW.badge_label) = '' THEN
      NEW.badge_label := v_badge.name;
    END IF;
  END IF;

  IF NEW.badge_id IS NOT NULL AND (NEW.badge_key IS NULL OR TRIM(NEW.badge_key) = '') THEN
    SELECT id, slug, name INTO v_badge
    FROM badges
    WHERE id = NEW.badge_id
    LIMIT 1;

    IF v_badge.id IS NOT NULL THEN
      NEW.badge_key := v_badge.slug;
      IF NEW.badge_label IS NULL OR TRIM(NEW.badge_label) = '' THEN
        NEW.badge_label := v_badge.name;
      END IF;
    END IF;
  END IF;

  NEW.progress_value := COALESCE(NEW.progress_value, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_user_badges_columns ON user_badges;
CREATE TRIGGER trg_sync_user_badges_columns
BEFORE INSERT OR UPDATE ON user_badges
FOR EACH ROW
EXECUTE FUNCTION trg_sync_user_badges_columns();

CREATE INDEX IF NOT EXISTS idx_user_badges_badge_id ON user_badges(badge_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_partner_user_id ON user_badges(partner_user_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_ritual_id ON user_badges(ritual_id);

