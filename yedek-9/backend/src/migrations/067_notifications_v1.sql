-- NOTIF v1 — son-part.md §11 (F4: share, forum, penalty)

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS notify_share_object BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_forum_comment BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_forum_repost BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_forum_upvote BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notify_penalty BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE forum_comments
  ADD COLUMN IF NOT EXISTS upvote_notify_milestone INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'notifications_type_check'
  ) THEN
    ALTER TABLE notifications DROP CONSTRAINT notifications_type_check;
  END IF;
END $$;

ALTER TABLE notifications
ADD CONSTRAINT notifications_type_check
CHECK (type IN (
  'ritual_live',
  'friend_joined_ritual',
  'venue_reopened',
  'friend_request_accepted',
  'feedback_available',
  'ritual_starting_soon',
  'ritual_almost_full',
  'rs_change',
  'friend_request',
  'badge_earned',
  'ritual_reminder',
  'maturation_upgrade',
  'feedback_deadline',
  'no_show_warning',
  'friend_activity',
  'venue_update',
  'share_object',
  'forum_comment',
  'forum_repost',
  'forum_upvote',
  'penalty_warning',
  'penalty_suspension',
  'penalty_host_ban',
  'replacement_invite',
  'replacement_result'
));
