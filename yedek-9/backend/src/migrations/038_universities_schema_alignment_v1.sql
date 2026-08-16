-- Migration 038: Align universities schema with backend-yeni.md (2.2 universities)

ALTER TABLE universities
  ADD COLUMN IF NOT EXISTS country VARCHAR(100),
  ADD COLUMN IF NOT EXISTS city VARCHAR(100),
  ADD COLUMN IF NOT EXISTS email_domains TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS member_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pending_review BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Align created_at type/default with doc
ALTER TABLE universities
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN created_at SET DEFAULT NOW();

-- Backfill domains from existing names when possible (safe default)
UPDATE universities
SET email_domains = COALESCE(email_domains, ARRAY[]::TEXT[])
WHERE email_domains IS NULL;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_universities_is_verified ON universities(is_verified);
CREATE INDEX IF NOT EXISTS idx_universities_pending_review ON universities(pending_review);
CREATE INDEX IF NOT EXISTS idx_universities_submitted_by ON universities(submitted_by);
