-- LOCAL v2 §9 — Badge 6-aile + venue-created badges + negative flags
-- Authority: LOCAL_Cursor_Build_Dokumani_v2-2.md §9

ALTER TABLE badges
  ADD COLUMN IF NOT EXISTS family VARCHAR(32),
  ADD COLUMN IF NOT EXISTS is_negative BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS venue_id UUID REFERENCES venues(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_badges_family ON badges (family);
CREATE INDEX IF NOT EXISTS idx_badges_venue ON badges (venue_id) WHERE venue_id IS NOT NULL;

-- Venue-created badges (shield template · admin approval · system grant)
CREATE TABLE IF NOT EXISTS venue_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  slug VARCHAR(80) NOT NULL,
  name VARCHAR(120) NOT NULL,
  logo_url TEXT,
  shield_template VARCHAR(32) NOT NULL DEFAULT 'shield_v1',
  condition_type VARCHAR(32) NOT NULL,
  condition_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(24) NOT NULL DEFAULT 'pending_approval',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  reviewer_note TEXT,
  global_badge_id UUID REFERENCES badges(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (venue_id, slug),
  CONSTRAINT chk_venue_badge_condition
    CHECK (condition_type IN ('visit', 'category', 'slot', 'event')),
  CONSTRAINT chk_venue_badge_status
    CHECK (status IN ('pending_approval', 'approved', 'rejected', 'retired'))
);

CREATE INDEX IF NOT EXISTS idx_venue_badges_venue_status
  ON venue_badges (venue_id, status);

CREATE TABLE IF NOT EXISTS venue_badge_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_badge_id UUID NOT NULL REFERENCES venue_badges(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  granted_by_system BOOLEAN NOT NULL DEFAULT true,
  ritual_id UUID REFERENCES rituals(id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (venue_badge_id, user_id)
);

-- Backfill family from spec_category where missing
UPDATE badges
SET family = CASE
  WHEN family IS NOT NULL THEN family
  WHEN spec_category IN ('content') THEN 'MASTERY'
  WHEN spec_category IN ('location', 'region') THEN 'ZONE'
  WHEN spec_category IN ('behavior') THEN 'BEHAVIORAL'
  WHEN spec_category IN ('special') THEN 'SPECIAL'
  WHEN spec_category IN ('venue') THEN 'VENUE'
  WHEN spec_category IN ('milestone') THEN 'MILESTONE'
  ELSE 'BEHAVIORAL'
END
WHERE family IS NULL;

-- Negatif slug'lar skor/kapı yolu değildir
UPDATE badges SET is_negative = true WHERE slug IN ('under_trial');
