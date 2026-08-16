-- Migration 057: Align university_registration_requests schema with backend-yeni.md §2.19

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'university_registration_request_status') THEN
    CREATE TYPE university_registration_request_status AS ENUM ('pending', 'approved', 'rejected');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS university_registration_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  university_name VARCHAR(255),
  university_city VARCHAR(100),
  university_country VARCHAR(100),
  email_domain VARCHAR(100),
  submitter_email VARCHAR(255),
  status university_registration_request_status DEFAULT 'pending',
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_university_registration_requests_submitted_by
  ON university_registration_requests(submitted_by);
CREATE INDEX IF NOT EXISTS idx_university_registration_requests_status
  ON university_registration_requests(status);
CREATE INDEX IF NOT EXISTS idx_university_registration_requests_created_at
  ON university_registration_requests(created_at DESC);

