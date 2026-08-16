-- F5 Adım 1: Venue başvuru / onboarding — son-part.md §9.1

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'venue_application_status') THEN
    CREATE TYPE venue_application_status AS ENUM ('pending', 'approved', 'rejected', 'withdrawn');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'venue_onboarding_step') THEN
    CREATE TYPE venue_onboarding_step AS ENUM (
      'application_submitted',
      'approved',
      'vitrine',
      'floor_plan',
      'gps_verified',
      'first_slot',
      'live'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS venue_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_name VARCHAR(255) NOT NULL,
  venue_name VARCHAR(255) NOT NULL,
  city VARCHAR(100) NOT NULL,
  address TEXT,
  location_lat DECIMAL(9, 6),
  location_lng DECIMAL(9, 6),
  category VARCHAR(100),
  description TEXT,
  proof_notes TEXT,
  proof_url TEXT,
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),
  status venue_application_status NOT NULL DEFAULT 'pending',
  onboarding_step venue_onboarding_step NOT NULL DEFAULT 'application_submitted',
  reviewer_note TEXT,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  venue_id UUID REFERENCES venues(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_venue_applications_user ON venue_applications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_venue_applications_status ON venue_applications(status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_venue_applications_one_pending_per_user
  ON venue_applications(user_id)
  WHERE status = 'pending';

-- NOTIF §11-F: başvuru sonucu
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_type_check') THEN
    ALTER TABLE notifications DROP CONSTRAINT notifications_type_check;
  END IF;
END $$;

ALTER TABLE notifications
ADD CONSTRAINT notifications_type_check
CHECK (type IN (
  'ritual_live', 'friend_joined_ritual', 'venue_reopened', 'friend_request_accepted',
  'feedback_available', 'ritual_starting_soon', 'ritual_almost_full', 'rs_change',
  'friend_request', 'badge_earned', 'ritual_reminder', 'maturation_upgrade',
  'feedback_deadline', 'no_show_warning', 'friend_activity', 'venue_update',
  'share_object', 'forum_comment', 'forum_repost', 'forum_upvote',
  'penalty_warning', 'penalty_suspension', 'penalty_host_ban',
  'replacement_invite', 'replacement_result', 'venue_application_result'
));
