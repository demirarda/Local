-- Migration 050: Align venue_ratings schema with backend-yeni.md §2.12

CREATE TABLE IF NOT EXISTS venue_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ritual_id UUID NOT NULL REFERENCES rituals(id) ON DELETE CASCADE,
  score SMALLINT NOT NULL CHECK (score BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_venue_ratings_venue_id ON venue_ratings(venue_id);
CREATE INDEX IF NOT EXISTS idx_venue_ratings_user_id ON venue_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_venue_ratings_ritual_id ON venue_ratings(ritual_id);

