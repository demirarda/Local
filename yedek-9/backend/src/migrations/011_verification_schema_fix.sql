-- Verification Schema Fix
-- Add status column if missing

-- Add status column to host_verifications if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'host_verifications' AND column_name = 'status'
  ) THEN
    ALTER TABLE host_verifications 
    ADD COLUMN status VARCHAR(20) DEFAULT 'active' 
    CHECK (status IN ('active', 'revoked', 'expired'));
  END IF;
END $$;

-- Add status column to venue_verifications if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'venue_verifications' AND column_name = 'status'
  ) THEN
    ALTER TABLE venue_verifications 
    ADD COLUMN status VARCHAR(20) DEFAULT 'active' 
    CHECK (status IN ('active', 'revoked', 'expired'));
  END IF;
END $$;

-- Update existing rows to 'active' if status is NULL
UPDATE host_verifications SET status = 'active' WHERE status IS NULL;
UPDATE venue_verifications SET status = 'active' WHERE status IS NULL;
