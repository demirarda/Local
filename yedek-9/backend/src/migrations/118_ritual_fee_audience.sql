-- sonMD §2C: rituals.fee{amount,currency,note} + rituals.audience PUBLIC|FRIENDS
-- visibility (public/venue_only/regular_only) remains separate — do not conflate.

ALTER TABLE rituals
  ADD COLUMN IF NOT EXISTS fee_amount NUMERIC(10,2) NULL,
  ADD COLUMN IF NOT EXISTS fee_currency VARCHAR(8) NULL DEFAULT 'TRY',
  ADD COLUMN IF NOT EXISTS fee_note TEXT NULL,
  ADD COLUMN IF NOT EXISTS audience VARCHAR(16) NOT NULL DEFAULT 'PUBLIC';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_rituals_audience'
  ) THEN
    ALTER TABLE rituals
      ADD CONSTRAINT chk_rituals_audience
      CHECK (audience IN ('PUBLIC', 'FRIENDS'));
  END IF;
END $$;

COMMENT ON COLUMN rituals.fee_amount IS 'Nullable declared fee; card shows ₺ badge when set';
COMMENT ON COLUMN rituals.fee_currency IS 'ISO-ish currency code; default TRY';
COMMENT ON COLUMN rituals.fee_note IS 'e.g. yerinde ödenir';
COMMENT ON COLUMN rituals.audience IS 'Discovery audience PUBLIC|FRIENDS (FL1–FL3 friends of host); separate from visibility';

CREATE INDEX IF NOT EXISTS idx_rituals_audience
  ON rituals (audience)
  WHERE audience = 'FRIENDS';
