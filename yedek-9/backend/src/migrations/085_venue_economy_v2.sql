-- LOCAL v2 §8 — Venue Economy packages, onboarding, suggestions, takeover
-- Authority: LOCAL_Cursor_Build_Dokumani_v2-2.md §8

-- Prefer VARCHAR for package tiers (free / operator / hakim); enum kept for legacy reads
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'venues'
      AND column_name = 'subscription_tier'
      AND udt_name = 'venue_subscription_tier'
  ) THEN
    ALTER TABLE venues
      ALTER COLUMN subscription_tier DROP DEFAULT;
    ALTER TABLE venues
      ALTER COLUMN subscription_tier TYPE VARCHAR(32)
      USING subscription_tier::text;
    ALTER TABLE venues
      ALTER COLUMN subscription_tier SET DEFAULT 'free';
  END IF;
END $$;

ALTER TABLE venues DROP CONSTRAINT IF EXISTS chk_venues_subscription_tier;

UPDATE venues
SET subscription_tier = CASE
  WHEN subscription_tier IN ('basic', 'free') THEN 'free'
  WHEN subscription_tier IN ('pro', 'operator') THEN 'operator'
  WHEN subscription_tier IN ('city_partner', 'hakim') THEN 'hakim'
  ELSE COALESCE(subscription_tier, 'free')
END;

ALTER TABLE venues
  ADD CONSTRAINT chk_venues_subscription_tier
  CHECK (subscription_tier IN ('free', 'basic', 'pro', 'operator', 'city_partner', 'hakim'));

UPDATE venues
SET pro_enabled = (subscription_tier IN ('operator', 'hakim', 'pro', 'city_partner')),
    city_partner_enabled = (subscription_tier IN ('hakim', 'city_partner'));

ALTER TABLE venues
  ADD COLUMN IF NOT EXISTS size_multiplier NUMERIC(4,2) DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS addon_slots INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS takeover_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS takeover_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS maps_url TEXT,
  ADD COLUMN IF NOT EXISTS social_url TEXT,
  ADD COLUMN IF NOT EXISTS commitment_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS vies_checked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS vies_ok BOOLEAN,
  ADD COLUMN IF NOT EXISTS photo_urls JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS sales_unlocked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS free_slot_month_key VARCHAR(7),
  ADD COLUMN IF NOT EXISTS free_slots_used_month INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS featured_event_card JSONB,
  ADD COLUMN IF NOT EXISTS closing_time TIME;

ALTER TABLE venue_applications
  ADD COLUMN IF NOT EXISTS maps_url TEXT,
  ADD COLUMN IF NOT EXISTS social_url TEXT,
  ADD COLUMN IF NOT EXISTS commitment_accepted BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS commitment_text TEXT,
  ADD COLUMN IF NOT EXISTS vies_vat TEXT,
  ADD COLUMN IF NOT EXISTS photo_urls JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS shadow_pitch JSONB;

ALTER TABLE venue_slot_suggestions
  ADD COLUMN IF NOT EXISTS behavior_summary TEXT,
  ADD COLUMN IF NOT EXISTS alt_suggested BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS alt_note TEXT,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS unanswered_notified_at TIMESTAMPTZ;

DO $$
BEGIN
  -- suggestion expiry uses status=rejected + reviewer_note (no new enum value required)
  NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_venue_suggestions_pending
  ON venue_slot_suggestions (venue_id, status) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_venues_takeover_until
  ON venues (takeover_until) WHERE takeover_until IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_venue_nominations_cluster
  ON venue_nominations (cluster_key, status, created_at DESC);
