-- F5 Adım 3: Venue slot + oneri kutusu — son-part.md §9.4

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'venue_slot_time_mode') THEN
    CREATE TYPE venue_slot_time_mode AS ENUM ('fixed', 'loose', 'recurring', 'instant');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'venue_slot_status') THEN
    CREATE TYPE venue_slot_status AS ENUM ('open', 'claimed', 'closed', 'cancelled');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'venue_slot_suggestion_status') THEN
    CREATE TYPE venue_slot_suggestion_status AS ENUM ('pending', 'approved', 'rejected');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS venue_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  location_label VARCHAR(255),
  time_mode venue_slot_time_mode NOT NULL DEFAULT 'fixed',
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  recurrence_rule TEXT,
  capacity INTEGER NOT NULL DEFAULT 1 CHECK (capacity >= 1),
  min_host_rs DECIMAL(4, 2),
  host_only BOOLEAN NOT NULL DEFAULT false,
  visibility VARCHAR(32) NOT NULL DEFAULT 'public',
  economy_stub JSONB NOT NULL DEFAULT '{}'::jsonb,
  status venue_slot_status NOT NULL DEFAULT 'open',
  claimed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  claimed_at TIMESTAMPTZ,
  ritual_id UUID REFERENCES rituals(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS venue_slot_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  location_label VARCHAR(255),
  time_mode venue_slot_time_mode NOT NULL DEFAULT 'loose',
  proposed_starts_at TIMESTAMPTZ,
  proposed_capacity INTEGER CHECK (proposed_capacity IS NULL OR proposed_capacity >= 1),
  status venue_slot_suggestion_status NOT NULL DEFAULT 'pending',
  reviewer_note TEXT,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  resulting_slot_id UUID REFERENCES venue_slots(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_venue_slots_venue_status ON venue_slots(venue_id, status, starts_at);
CREATE INDEX IF NOT EXISTS idx_venue_slot_suggestions_venue ON venue_slot_suggestions(venue_id, status, created_at DESC);

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
  'replacement_invite', 'replacement_result', 'venue_application_result',
  'venue_suggestion', 'venue_slot_claimed'
));
