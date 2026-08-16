-- son-part.md tamamlama: floor_plan, gps, shadow-venue, recurring stub, NOTIF genisletme

ALTER TABLE venues
  ADD COLUMN IF NOT EXISTS floor_plan JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS gps_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS shadow_link_completed_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS ritual_recurring_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_ritual_id UUID NOT NULL REFERENCES rituals(id) ON DELETE CASCADE,
  instance_ritual_id UUID REFERENCES rituals(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ritual_recurring_parent ON ritual_recurring_instances(parent_ritual_id, scheduled_at);

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
  'venue_suggestion', 'venue_slot_claimed',
  'checkin_open', 'door_closing', 'keyword_opened', 'exact_details_unlocked',
  'window_opened', 'feedback_closing', 'join_confirmed', 'recurring_instance',
  'venue_memory_archived', 'seating_status_change', 'badge_approval',
  'late_arrival_join', 'ritual_cancelled'
));
