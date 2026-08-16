-- F5 Adım 2: Venue profil — vitrin (public) + kilitli alanlar — son-part.md §9.1 / §9.6

ALTER TABLE venues
  ADD COLUMN IF NOT EXISTS vitrine JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS vitrine_published BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS highlighted_badge_keys TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN venues.vitrine IS 'Public vitrin: headline, tagline, cover_url, photo_urls[], hours, amenities[]';
COMMENT ON COLUMN venues.vitrine_published IS 'false = vitrin taslak; public profilde gizli';
COMMENT ON COLUMN venues.highlighted_badge_keys IS 'Profilde one cikan rozetler (max 5)';
