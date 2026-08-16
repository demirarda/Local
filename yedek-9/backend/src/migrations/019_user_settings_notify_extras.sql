-- Add optional notification prefs: friend request accepted, venue reopened
-- Migration 019

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS notify_friend_request_accepted BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_venue_reopened BOOLEAN DEFAULT true;

COMMENT ON COLUMN user_settings.notify_friend_request_accepted IS 'Push when a friend request is accepted';
COMMENT ON COLUMN user_settings.notify_venue_reopened IS 'Push when a followed venue reopens';
