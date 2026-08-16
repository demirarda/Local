-- BC3 Fix: Add delta_before_bc3 column
-- BC3 should use raw deltas (before BC3 is applied), not BC3-adjusted deltas

ALTER TABLE rs_delta_history 
ADD COLUMN IF NOT EXISTS delta_before_bc3 DECIMAL(5,3);

-- Update existing records (if any) - set delta_before_bc3 = delta for now
-- (This is a best-effort fix for existing data)
UPDATE rs_delta_history 
SET delta_before_bc3 = delta 
WHERE delta_before_bc3 IS NULL;
