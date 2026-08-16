-- Migration 029: Manual university verification requests

CREATE TABLE IF NOT EXISTS university_verification_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  university_name VARCHAR(255) NOT NULL,
  website VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by VARCHAR(100),
  reviewed_at TIMESTAMP,
  review_note TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(email, university_name)
);

CREATE INDEX IF NOT EXISTS idx_university_verification_requests_status
  ON university_verification_requests(status);

CREATE INDEX IF NOT EXISTS idx_university_verification_requests_created_at
  ON university_verification_requests(created_at DESC);
