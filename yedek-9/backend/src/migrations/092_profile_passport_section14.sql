-- LOCAL v2 §14 — profil/passport + üni-profili + ritüel koşulları
-- Authority: LOCAL_Cursor_Build_Dokumani_v2-2.md §14

-- Kullanıcı ritüelleri: min-RS YOK; badge + üni kapısı VAR
ALTER TABLE rituals
  ADD COLUMN IF NOT EXISTS university_gate VARCHAR(24),
  ADD COLUMN IF NOT EXISTS required_badge_slug VARCHAR(64);

-- Clear legacy min_rs on user rituals (venue slots keep their own min_host_rs)
COMMENT ON COLUMN rituals.min_rs IS 'DEPRECATED §14 — user rituals must not use min-RS; always NULL';

-- Passport bio-quote (tek quote, arşivden)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS bio_quote_memory_id UUID REFERENCES memories(id) ON DELETE SET NULL;

-- Üni topluluk profili
ALTER TABLE universities
  ADD COLUMN IF NOT EXISTS admin_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS visibility VARCHAR(24) NOT NULL DEFAULT 'closed',
  ADD COLUMN IF NOT EXISTS vitrine JSONB NOT NULL DEFAULT '{}'::jsonb;

-- visibility: closed | external_uni | everyone
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_universities_visibility'
  ) THEN
    ALTER TABLE universities
      ADD CONSTRAINT chk_universities_visibility
      CHECK (visibility IN ('closed', 'external_uni', 'everyone'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS university_official_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_uni_official_events_uni
  ON university_official_events (university_id, starts_at DESC NULLS LAST);

-- Ensure university_gate values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_rituals_university_gate'
  ) THEN
    ALTER TABLE rituals
      ADD CONSTRAINT chk_rituals_university_gate
      CHECK (
        university_gate IS NULL
        OR university_gate IN ('same_uni', 'uni_only')
      );
  END IF;
END $$;
