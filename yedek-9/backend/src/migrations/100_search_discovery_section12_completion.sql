-- LOCAL v2 §12 completion: brand entity · web_named · window_visibility
-- Authority: LOCAL_Cursor_Build_Dokumani_v2 final.md §12

ALTER TABLE brands
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS category VARCHAR(64),
  ADD COLUMN IF NOT EXISTS one_liner TEXT,
  ADD COLUMN IF NOT EXISTS slug VARCHAR(120),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS ux_brands_slug
  ON brands (slug)
  WHERE slug IS NOT NULL;

CREATE TABLE IF NOT EXISTS brand_members (
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(32) NOT NULL DEFAULT 'member',
  verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (brand_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_brand_members_user
  ON brand_members (user_id);

ALTER TABLE rituals
  ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES brands(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_rituals_brand
  ON rituals (brand_id)
  WHERE brand_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ritual_window_visibility') THEN
    CREATE TYPE ritual_window_visibility AS ENUM ('TRANSPARENT', 'CLOSED');
  END IF;
END $$;

ALTER TABLE rituals
  ADD COLUMN IF NOT EXISTS window_visibility ritual_window_visibility NOT NULL DEFAULT 'CLOSED';

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS web_named BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE zones
  ADD COLUMN IF NOT EXISTS slug VARCHAR(120);

CREATE UNIQUE INDEX IF NOT EXISTS ux_zones_slug
  ON zones (slug)
  WHERE slug IS NOT NULL;
