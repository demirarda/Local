-- Verification Schema
-- Migration 011: Add host and venue verification system

-- Host verifications table
CREATE TABLE IF NOT EXISTS host_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  verified_by VARCHAR(100), -- e.g., 'admin', 'university', 'organization'
  verification_type VARCHAR(50) DEFAULT 'standard' CHECK (verification_type IN ('standard', 'premium', 'university', 'organization')),
  verified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP, -- Optional expiration
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
  UNIQUE(user_id)
);

-- Venue verifications table
CREATE TABLE IF NOT EXISTS venue_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_name VARCHAR(255) NOT NULL,
  city VARCHAR(100) NOT NULL,
  verified_by VARCHAR(100), -- e.g., 'admin', 'university', 'organization'
  verification_type VARCHAR(50) DEFAULT 'standard' CHECK (verification_type IN ('standard', 'premium', 'university', 'organization')),
  verified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP, -- Optional expiration
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
  UNIQUE(venue_name, city)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_host_verifications_user ON host_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_host_verifications_status ON host_verifications(status);
CREATE INDEX IF NOT EXISTS idx_venue_verifications_venue ON venue_verifications(venue_name, city);
CREATE INDEX IF NOT EXISTS idx_venue_verifications_status ON venue_verifications(status);

-- Add comments
COMMENT ON TABLE host_verifications IS 'Host verification system for trusted hosts';
COMMENT ON TABLE venue_verifications IS 'Venue verification system for trusted venues';
