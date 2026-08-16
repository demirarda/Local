-- sonMD Sosyal Ürün Temelleri — kalan %4 (kategori notif + hesap silme izi)
-- §2: 6 kategori toggle · §3: self-delete / eski üye

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS notify_cat_ritual_door BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_cat_mention_soz BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_cat_friendship BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_cat_series_venue BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_cat_consent_safety BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_cat_product_digest BOOLEAN NOT NULL DEFAULT true;

-- Mentions → bildirim merkezi (push tercihe bağlı / kategori)
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
  'venue_ritual_started', 'venue_ritual_ended',
  'badge_approaching', 'fl_change', 'ds_tier', 'public_memory_follow',
  'memory_soz', 'memory_echo', 'memory_upvote', 'rare_host_ritual', 'night_report',
  'regular_gained', 'keyword_escrow_offer', 'weekly_digest',
  'mention', 'follow_request'
));

ALTER TABLE memories
  ADD COLUMN IF NOT EXISTS withdrawn_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS withdrawn_reason VARCHAR(64);

COMMENT ON COLUMN user_settings.notify_cat_ritual_door IS 'Sosyal §2 — ritüel/kapı kategorisi';
COMMENT ON COLUMN user_settings.notify_cat_mention_soz IS 'Sosyal §2 — mention ve söz';
COMMENT ON COLUMN user_settings.notify_cat_friendship IS 'Sosyal §2 — arkadaşlık';
COMMENT ON COLUMN user_settings.notify_cat_series_venue IS 'Sosyal §2 — Series/venue';
COMMENT ON COLUMN user_settings.notify_cat_consent_safety IS 'Sosyal §2 — rıza-güvenlik';
COMMENT ON COLUMN user_settings.notify_cat_product_digest IS 'Sosyal §2 — ürün özeti / digest';
