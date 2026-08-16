-- son-part.md §11 NOTIF tamamlama + penalty end tracking

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS penalty_suspension_end_notified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS host_ban_end_notified_at TIMESTAMPTZ;

ALTER TABLE rituals
  ADD COLUMN IF NOT EXISTS venue_ritual_start_notified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS venue_ritual_end_notified_at TIMESTAMPTZ;

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
  'penalty_suspension_end', 'penalty_host_ban_end',
  'replacement_invite', 'replacement_result', 'replacement_required',
  'venue_application_result', 'venue_suggestion', 'venue_slot_claimed',
  'checkin_open', 'door_closing', 'keyword_opened', 'exact_details_unlocked',
  'window_opened', 'feedback_closing', 'join_confirmed', 'recurring_instance',
  'venue_memory_archived', 'seating_status_change', 'badge_approval',
  'late_arrival_join', 'ritual_cancelled',
  'prelobby_message', 'quote_discussion_invite',
  'venue_ritual_started', 'venue_ritual_ended'
));
