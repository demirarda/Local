-- sonMD yapısal %100: venue_claim · window readers · affiliations · friends_list_public alias
-- Authority: LOCAL_Cursor_Build_Dokumani_v3 §2C §2D §2Ağu-3

ALTER TABLE rituals
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS claimed_by_venue_id UUID REFERENCES venues(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_rituals_claimed_by_venue
  ON rituals (claimed_by_venue_id)
  WHERE claimed_by_venue_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS ritual_window_readers (
  ritual_id UUID NOT NULL REFERENCES rituals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (ritual_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_ritual_window_readers_seen
  ON ritual_window_readers (ritual_id, last_seen_at DESC);

-- affiliations: UNI_AUTO (universities.id) | BRAND_ADMIN (brands.id)
CREATE TABLE IF NOT EXISTS affiliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL,
  type VARCHAR(24) NOT NULL CHECK (type IN ('UNI_AUTO', 'BRAND_ADMIN')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, org_id, type)
);

CREATE INDEX IF NOT EXISTS idx_affiliations_org_type
  ON affiliations (org_id, type);

CREATE INDEX IF NOT EXISTS idx_affiliations_user
  ON affiliations (user_id);

-- Spec name alias on users (mirrors user_settings.show_friends_list; app may use either)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS friends_list_public BOOLEAN NOT NULL DEFAULT false;

-- Backfill from settings when present
UPDATE users u
SET friends_list_public = COALESCE(us.show_friends_list, false)
FROM user_settings us
WHERE us.user_id = u.id
  AND u.friends_list_public IS DISTINCT FROM COALESCE(us.show_friends_list, false);
