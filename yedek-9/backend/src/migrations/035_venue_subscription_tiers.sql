-- 7.2 Subscription tiers for venues
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'venues'
      AND column_name = 'subscription_tier'
  ) THEN
    ALTER TABLE venues
    ADD COLUMN subscription_tier VARCHAR(32) DEFAULT 'free';
  END IF;
END $$;

ALTER TABLE venues
ADD COLUMN IF NOT EXISTS pro_enabled BOOLEAN DEFAULT false;

ALTER TABLE venues
ADD COLUMN IF NOT EXISTS city_partner_enabled BOOLEAN DEFAULT false;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'venues'
      AND column_name = 'subscription_tier'
      AND data_type = 'character varying'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'chk_venues_subscription_tier'
    ) THEN
      ALTER TABLE venues
      ADD CONSTRAINT chk_venues_subscription_tier
      CHECK (subscription_tier IN ('free', 'pro', 'city_partner'));
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'venues'
      AND column_name = 'subscription_tier'
      AND data_type = 'character varying'
  ) THEN
    UPDATE venues
    SET subscription_tier = 'free',
        pro_enabled = false,
        city_partner_enabled = false
    WHERE subscription_tier IS NULL;
  ELSE
    UPDATE venues
    SET subscription_tier = 'basic'::venue_subscription_tier,
        pro_enabled = false,
        city_partner_enabled = false
    WHERE subscription_tier IS NULL;
  END IF;
END $$;
