-- 4.6 Notifications: expand notification type list
-- Idempotent: do not shrink an already-expanded constraint (later migrations / live data).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'notifications_type_check'
  ) THEN
    ALTER TABLE notifications DROP CONSTRAINT notifications_type_check;
  END IF;
END $$;

DO $$
BEGIN
  -- Skip narrow CHECK if rows already use types introduced by later migrations.
  IF EXISTS (
    SELECT 1 FROM notifications
    WHERE type::text NOT IN (
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
      'venue_update'
    )
  ) THEN
    RAISE NOTICE '033: skipping narrow notifications_type_check — newer notification types already present';
    RETURN;
  END IF;

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
    'venue_update'
  ));
END $$;
