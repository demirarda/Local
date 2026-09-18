-- §12 üyelik vitrini + seller-at-venue / org-to-org (launch-direkt, flag değil)

ALTER TABLE venues
  ADD COLUMN IF NOT EXISTS membership_vitrine_enabled BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE venues
  ADD COLUMN IF NOT EXISTS category TEXT;

CREATE TABLE IF NOT EXISTS venue_membership_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  seller_type TEXT NOT NULL DEFAULT 'venue'
    CHECK (seller_type IN ('venue', 'seller_at_venue', 'org_to_org')),
  seller_venue_id UUID REFERENCES venues(id) ON DELETE SET NULL,
  seller_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  seller_name TEXT NOT NULL,
  seller_verified BOOLEAN NOT NULL DEFAULT false,
  title TEXT NOT NULL,
  plan_kind TEXT NOT NULL CHECK (plan_kind IN ('monthly', 'credit')),
  credits INT,
  auto_drop_on_seal BOOLEAN NOT NULL DEFAULT true,
  instant_admit BOOLEAN NOT NULL DEFAULT true,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_venue_membership_plans_host
  ON venue_membership_plans (host_venue_id)
  WHERE active = true;

CREATE TABLE IF NOT EXISTS venue_membership_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES venue_membership_plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active',
  credits_left INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (plan_id, user_id)
);

CREATE TABLE IF NOT EXISTS seller_fulfillment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  seller_venue_id UUID REFERENCES venues(id) ON DELETE SET NULL,
  host_venue_id UUID REFERENCES venues(id) ON DELETE SET NULL,
  plan_id UUID REFERENCES venue_membership_plans(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('attempted', 'fulfilled', 'denied')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seller_fulfillment_seller_user
  ON seller_fulfillment_events (seller_user_id)
  WHERE seller_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_seller_fulfillment_seller_venue
  ON seller_fulfillment_events (seller_venue_id)
  WHERE seller_venue_id IS NOT NULL;

COMMENT ON TABLE venue_membership_plans IS '§12 mekan + seller-at-venue + org-to-org planları; payout satıcıya; RS/DS yok';
COMMENT ON COLUMN venues.membership_vitrine_enabled IS 'Üyelik vitrini default AÇIK; mekan kapatabilir';
