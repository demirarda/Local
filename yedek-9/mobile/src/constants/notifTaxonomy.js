/** son-part.md §11 NOTIF taxonomy — shared mobile/backend labels */

import { navigateFromNotification } from '../utils/notificationRouting';

export const NOTIF_TABS = ['Tümü', 'Rituals', 'Sosyal', 'Local World', 'Venue', 'Ceza', 'RS'];

export const NOTIF_TYPE_META = {
  ritual_reminder: { category: 'Rituals', title: 'Ritual Yaklaşıyor' },
  ritual_starting_soon: { category: 'Rituals', title: 'Ritual Yaklaşıyor' },
  ritual_live: { category: 'Rituals', title: 'Ritual Canlı' },
  checkin_open: { category: 'Rituals', title: 'Check-in Açık' },
  door_closing: { category: 'Rituals', title: 'Kapı Kapanıyor' },
  keyword_opened: { category: 'Rituals', title: 'Keyword Açıldı' },
  ritual_opened: { category: 'Rituals', title: 'Masa Açıldı' },
  exact_details_unlocked: { category: 'Rituals', title: 'Exact Detay Açıldı' },
  window_opened: { category: 'Rituals', title: 'Window Açıldı' },
  feedback_available: { category: 'Rituals', title: 'Feedback Zamanı' },
  feedback_closing: { category: 'Rituals', title: 'Feedback Kapanıyor' },
  feedback_deadline: { category: 'RS', title: 'Geri Bildirim Son Tarihi' },
  ritual_cancelled: { category: 'Rituals', title: 'Ritual İptal' },
  replacement_invite: { category: 'Ceza', title: 'Replacement Daveti' },
  replacement_result: { category: 'Ceza', title: 'Replacement Sonucu' },
  replacement_required: { category: 'Ceza', title: 'Replacement Zorunlu' },
  join_confirmed: { category: 'Rituals', title: 'Join Onayı' },
  recurring_instance: { category: 'Rituals', title: 'Seri' },
  late_arrival_join: { category: 'Rituals', title: 'Geç Katılımcı' },
  no_show_warning: { category: 'Ceza', title: 'Katılım Kaydı' },
  friend_request: { category: 'Sosyal', title: 'Arkadaşlık İsteği' },
  friend_request_accepted: { category: 'Sosyal', title: 'İstek Kabul Edildi' },
  friend_activity: { category: 'Sosyal', title: 'Arkadaş Aktivitesi' },
  friend_joined_ritual: { category: 'Sosyal', title: 'Arkadaş Katıldı' },
  share_object: { category: 'Sosyal', title: 'Paylaşım' },
  prelobby_message: { category: 'Sosyal', title: 'Prelobby Mesajı' },
  fl_change: { category: 'Sosyal', title: 'FL Değişimi' },
  forum_comment: { category: 'Local World', title: 'Forum Yorumu' },
  forum_repost: { category: 'Local World', title: 'Forum Repost' },
  forum_upvote: { category: 'Local World', title: 'Forum Beğeni' },
  quote_discussion_invite: { category: 'Local World', title: 'Quote Discussion' },
  public_memory_follow: { category: 'Local World', title: 'Public Anı' },
  badge_earned: { category: 'RS', title: 'Rozet Kazanıldı' },
  badge_approaching: { category: 'RS', title: 'Rozete Yaklaştın' },
  badge_approval: { category: 'Venue', title: 'Rozet Onayı' },
  ds_tier: { category: 'RS', title: 'DS Tier' },
  maturation_upgrade: { category: 'RS', title: 'Olgunluk' },
  rs_change: { category: 'RS', title: 'RS Değişimi' },
  penalty_warning: { category: 'Ceza', title: 'Katılım Kaydı' },
  penalty_suspension: { category: 'Ceza', title: 'Askı' },
  penalty_host_ban: { category: 'Ceza', title: 'Host Ban' },
  penalty_suspension_end: { category: 'Ceza', title: 'Askı Bitti' },
  penalty_host_ban_end: { category: 'Ceza', title: 'Host Ban Bitti' },
  venue_suggestion: { category: 'Venue', title: 'Venue Öneri' },
  venue_slot_claimed: { category: 'Venue', title: 'Slot Kapıldı' },
  venue_ritual_started: { category: 'Venue', title: 'Venue Ritual Başladı' },
  venue_ritual_ended: { category: 'Venue', title: 'Venue Ritual Bitti' },
  venue_memory_archived: { category: 'Venue', title: 'Arşive Memory' },
  seating_status_change: { category: 'Venue', title: 'Oturma Durumu' },
  venue_application_result: { category: 'Venue', title: 'Başvuru Sonucu' },
  venue_update: { category: 'Venue', title: 'Mekan Güncellemesi' },
  venue_reopened: { category: 'Venue', title: 'Mekan Yeniden Açıldı' },
};

export function normalizeNotifType(rawType) {
  return String(rawType || '').toLowerCase().trim().replace(/-/g, '_');
}

export function getNotifMeta(item) {
  const type = normalizeNotifType(item?.type);
  const data = item?.data || {};
  if (type === 'friend_activity' && data.activity === 'friend_joined_ritual') {
    return { category: 'Sosyal', title: 'Arkadaş Katıldı' };
  }
  return NOTIF_TYPE_META[type] || { category: 'Tümü', title: item?.title || 'Bildirim' };
}

export function buildNotifBody(item) {
  const data = item?.data || {};
  const type = normalizeNotifType(item?.type);
  if (item?.body) return item.body;
  if (type === 'friend_activity' && data.activity === 'friend_joined_ritual') {
    return `${data.friend_name || 'Arkadaş'} "${data.ritual_title || 'Ritual'}" Ritualine katıldı`;
  }
  return item?.message || 'Bildirim';
}

export function navigateFromNotifItem(navigation, item) {
  const data = { ...(item?.data || {}), type: item?.type, screen: item?.data?.screen };
  navigateFromNotification({ current: navigation }, data);
}
