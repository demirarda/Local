import pool from '../config/database.js';
import logger from '../utils/logger.js';
import LOCAL_CONFIG from '../config/localConfig.js';

// Expo Push Notification API endpoint
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/** §11 — in-app only; no push (unless user explicitly opts in via settings).
 *  badge_approaching sahibe push (§13 — PUSH_DEFAULTS.badge_approach). */
export const PUSH_SILENT_TYPES = new Set([
  'fl_change',
  'ds_tier',
  'public_memory_follow',
]);

function parseHm(value, fallback = '01:00') {
  const m = String(value || fallback).trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return { h: Number(m[1]), min: Number(m[2]) };
}

function minutesSinceMidnight(h, min) {
  return h * 60 + min;
}

export function isWithinQuietHours(startHm, endHm, now = new Date()) {
  const start = parseHm(startHm, '01:00');
  const end = parseHm(endHm, '09:00');
  if (!start || !end) return false;
  const cur = minutesSinceMidnight(now.getHours(), now.getMinutes());
  const s = minutesSinceMidnight(start.h, start.min);
  const e = minutesSinceMidnight(end.h, end.min);
  if (s === e) return false;
  if (s < e) return cur >= s && cur < e;
  return cur >= s || cur < e;
}

/** sonMD Sosyal §2 — söz verilen masanın açılış / mühür / kapı quiet'i deler */
export const QUIET_HOURS_OVERRIDE_TYPES = new Set([
  'ritual_opened',
  'ritual_live',
  'door_closing',
  'join_confirmed',
  'exact_details_unlocked',
  'checkin_sealed',
  'first_seal',
  'pending_witness',
]);

export function piercesQuietHours(type) {
  return QUIET_HOURS_OVERRIDE_TYPES.has(String(type || ''));
}

async function isUserQuietHours(userId, type = null) {
  try {
    if (piercesQuietHours(type)) return false;
    const r = await pool.query(
      `SELECT notify_quiet_hours_enabled, notify_quiet_start, notify_quiet_end
       FROM user_settings WHERE user_id = $1`,
      [userId]
    );
    const row = r.rows[0];
    // Default ON when no row — sonMD 01–09
    if (!row) {
      return isWithinQuietHours('01:00', '09:00');
    }
    if (row.notify_quiet_hours_enabled === false) return false;
    return isWithinQuietHours(
      row.notify_quiet_start || '01:00',
      row.notify_quiet_end || '09:00'
    );
  } catch (_e) {
    return false;
  }
}

/**
 * Send push notification to Expo device tokens
 * @param {Array} tokens - Array of Expo push tokens
 * @param {Object} notification - Notification object { title, body, data }
 * @returns {Promise} Response from Expo API
 */
async function sendExpoPushNotification(tokens, notification) {
  if (!tokens || tokens.length === 0) {
    return { success: false, error: 'No tokens provided' };
  }

  const messages = tokens.map(token => ({
    to: token,
    sound: 'default',
    title: notification.title,
    body: notification.body,
    data: notification.data || {},
    priority: 'high',
    channelId: 'default',
  }));

  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    const result = await response.json();
    
    // Expo returns an array of results
    if (Array.isArray(result.data)) {
      const errors = result.data.filter(r => r.status === 'error');
      if (errors.length > 0) {
        logger.warn('Some push notifications failed', { 
          errors,
          totalTokens: tokens.length,
          failedCount: errors.length 
        });
      }
    }

    logger.debug('Push notifications sent', { 
      tokensCount: tokens.length,
      notificationTitle: notification.title 
    });

    return { success: true, result };
  } catch (error) {
    logger.error('Error sending Expo push notification', { 
      error: error.message, 
      stack: error.stack,
      tokensCount: tokens.length 
    });
    return { success: false, error: error.message };
  }
}

/**
 * Get device tokens for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of device tokens
 */
async function getUserDeviceTokens(userId) {
  try {
    const result = await pool.query(
      `SELECT token FROM device_tokens WHERE user_id = $1`,
      [userId]
    );
    return result.rows.map(row => row.token);
  } catch (error) {
    logger.error('Error fetching device tokens', { 
      error: error.message, 
      stack: error.stack,
      userId 
    });
    return [];
  }
}

/**
 * Register device token for a user
 * @param {string} userId - User ID
 * @param {string} token - Expo push token
 * @param {string} platform - Platform ('ios', 'android', 'web')
 * @returns {Promise<Object>} Result
 */
async function registerDeviceToken(userId, token, platform = 'ios') {
  try {
    await pool.query(
      `INSERT INTO device_tokens (user_id, token, platform)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, token) 
       DO UPDATE SET updated_at = CURRENT_TIMESTAMP, platform = $3`,
      [userId, token, platform]
    );
    logger.debug('Device token registered', { userId, platform });
    return { success: true };
  } catch (error) {
    logger.error('Error registering device token', { 
      error: error.message, 
      stack: error.stack,
      userId,
      platform 
    });
    return { success: false, error: error.message };
  }
}

/**
 * Unregister device token
 * @param {string} userId - User ID
 * @param {string} token - Expo push token
 * @returns {Promise<Object>} Result
 */
async function unregisterDeviceToken(userId, token) {
  try {
    await pool.query(
      `DELETE FROM device_tokens WHERE user_id = $1 AND token = $2`,
      [userId, token]
    );
    logger.debug('Device token unregistered', { userId });
    return { success: true };
  } catch (error) {
    logger.error('Error unregistering device token', { 
      error: error.message, 
      stack: error.stack,
      userId 
    });
    return { success: false, error: error.message };
  }
}

/**
 * Save notification to database
 * @param {string} userId - User ID
 * @param {string} type - Notification type
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {Object} data - Additional data
 * @returns {Promise<Object>} Saved notification
 */
async function saveNotification(userId, type, title, body, data = {}) {
  try {
    const result = await pool.query(
      `INSERT INTO notifications (user_id, type, title, body, data)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, type, title, body, JSON.stringify(data)]
    );
    logger.debug('Notification saved', { userId, type, title });
    return result.rows[0];
  } catch (error) {
    logger.error('Error saving notification', { 
      error: error.message, 
      stack: error.stack,
      userId,
      type 
    });
    return null;
  }
}

/**
 * Check if user has enabled this notification type in settings
 * @param {string} userId - User ID
 * @param {string} type - Notification type (ritual_live, friend_joined_ritual, etc.)
 * @returns {Promise<boolean>} true if we should send (setting on or not set)
 */

/** sonMD Sosyal §2 — 6 kategori kapısı */
export const NOTIF_CATEGORY_COLUMNS = {
  ritual_door: 'notify_cat_ritual_door',
  mention_soz: 'notify_cat_mention_soz',
  friendship: 'notify_cat_friendship',
  series_venue: 'notify_cat_series_venue',
  consent_safety: 'notify_cat_consent_safety',
  product_digest: 'notify_cat_product_digest',
};

export const NOTIF_TYPE_CATEGORY = {
  ritual_live: 'ritual_door',
  ritual_starting_soon: 'ritual_door',
  ritual_almost_full: 'ritual_door',
  ritual_reminder: 'ritual_door',
  checkin_open: 'ritual_door',
  door_closing: 'ritual_door',
  keyword_opened: 'ritual_door',
  exact_details_unlocked: 'ritual_door',
  join_confirmed: 'ritual_door',
  ritual_cancelled: 'ritual_door',
  late_arrival_join: 'ritual_door',
  window_opened: 'ritual_door',
  feedback_closing: 'ritual_door',
  prelobby_message: 'ritual_door',
  memory_soz: 'mention_soz',
  mention: 'mention_soz',
  forum_comment: 'mention_soz',
  quote_discussion_invite: 'mention_soz',
  memory_echo: 'mention_soz',
  friend_request: 'friendship',
  friend_request_accepted: 'friendship',
  friend_accepted: 'friendship',
  friend_joined_ritual: 'friendship',
  friend_activity: 'friendship',
  follow_request: 'friendship',
  share_object: 'friendship',
  venue_reopened: 'series_venue',
  venue_update: 'series_venue',
  venue_suggestion: 'series_venue',
  venue_slot_claimed: 'series_venue',
  seating_status_change: 'series_venue',
  recurring_instance: 'series_venue',
  venue_ritual_started: 'series_venue',
  venue_ritual_ended: 'series_venue',
  venue_memory_archived: 'series_venue',
  venue_application_result: 'series_venue',
  rare_host_ritual: 'series_venue',
  regular_gained: 'series_venue',
  penalty_warning: 'consent_safety',
  penalty_suspension: 'consent_safety',
  penalty_host_ban: 'consent_safety',
  penalty_suspension_end: 'consent_safety',
  penalty_host_ban_end: 'consent_safety',
  no_show_warning: 'consent_safety',
  replacement_invite: 'consent_safety',
  replacement_result: 'consent_safety',
  replacement_required: 'consent_safety',
  feedback_available: 'consent_safety',
  feedback_deadline: 'consent_safety',
  weekly_digest: 'product_digest',
  night_report: 'product_digest',
  badge_approaching: 'product_digest',
  badge_earned: 'product_digest',
  badge_approval: 'product_digest',
  forum_repost: 'product_digest',
  forum_upvote: 'product_digest',
  public_memory_follow: 'product_digest',
};

async function shouldSendNotification(userId, type) {
  if (PUSH_SILENT_TYPES.has(type)) return true;

  const cat = NOTIF_TYPE_CATEGORY[type];
  if (cat) {
    const catCol = NOTIF_CATEGORY_COLUMNS[cat];
    try {
      const cr = await pool.query(`SELECT ${catCol} FROM user_settings WHERE user_id = $1`, [userId]);
      if (cr.rows.length && cr.rows[0][catCol] === false) return false;
    } catch (e) {
      logger.warn('shouldSendNotification category check failed', {
        userId,
        type,
        cat,
        error: e.message,
      });
    }
  }

  const settingMap = {
    ritual_live: 'notify_ritual_live',
    friend_joined_ritual: 'notify_friend_joined_ritual',
    feedback_available: 'notify_feedback_available',
    ritual_starting_soon: 'notify_ritual_starting_soon',
    ritual_almost_full: 'notify_ritual_almost_full',
    friend_request_accepted: 'notify_friend_request_accepted',
    venue_reopened: 'notify_venue_reopened',
    ritual_reminder: 'notify_ritual_starting_soon',
    feedback_deadline: 'notify_feedback_available',
    no_show_warning: 'notify_penalty',
    friend_request: 'notify_friend_request_accepted',
    friend_accepted: 'notify_friend_request_accepted',
    friend_activity: 'notify_friend_joined_ritual',
    venue_update: 'notify_venue_reopened',
    rs_change: 'notify_feedback_available',
    maturation_upgrade: 'notify_feedback_available',
    badge_earned: 'notify_feedback_available',
    share_object: 'notify_share_object',
    forum_comment: 'notify_forum_comment',
    forum_repost: 'notify_forum_repost',
    forum_upvote: 'notify_forum_upvote',
    penalty_warning: 'notify_penalty',
    penalty_suspension: 'notify_penalty',
    penalty_host_ban: 'notify_penalty',
    replacement_invite: 'notify_penalty',
    replacement_result: 'notify_penalty',
    venue_application_result: 'notify_ritual_live',
    venue_suggestion: 'notify_venue_reopened',
    venue_slot_claimed: 'notify_venue_reopened',
    checkin_open: 'notify_ritual_starting_soon',
    door_closing: 'notify_ritual_starting_soon',
    keyword_opened: 'notify_ritual_starting_soon',
    exact_details_unlocked: 'notify_ritual_starting_soon',
    window_opened: 'notify_feedback_available',
    feedback_closing: 'notify_feedback_available',
    join_confirmed: 'notify_friend_joined_ritual',
    recurring_instance: 'notify_ritual_starting_soon',
    venue_memory_archived: 'notify_venue_reopened',
    seating_status_change: 'notify_venue_reopened',
    badge_approval: 'notify_feedback_available',
    late_arrival_join: 'notify_ritual_starting_soon',
    ritual_cancelled: 'notify_ritual_starting_soon',
    prelobby_message: 'notify_friend_joined_ritual',
    quote_discussion_invite: 'notify_forum_comment',
    penalty_suspension_end: 'notify_penalty',
    penalty_host_ban_end: 'notify_penalty',
    replacement_required: 'notify_penalty',
    venue_ritual_started: 'notify_venue_reopened',
    venue_ritual_ended: 'notify_venue_reopened',
    fl_change: 'notify_fl_change',
    ds_tier: 'notify_ds_tier',
    public_memory_follow: 'notify_public_memory_follow',
    badge_approaching: 'notify_badge_approaching',
    mention: 'notify_cat_mention_soz',
    follow_request: 'notify_cat_friendship',
    weekly_digest: 'notify_weekly_digest',
  };
  const col = settingMap[type];
  if (!col) return true;
  try {
    const r = await pool.query(
      `SELECT ${col} FROM user_settings WHERE user_id = $1`,
      [userId]
    );
    if (r.rows.length === 0) return true;
    return r.rows[0][col] !== false;
  } catch (e) {
    logger.warn('shouldSendNotification check failed', { userId, type, error: e.message });
    return true;
  }
}

/**
 * Send notification to user
 * @param {string} userId - User ID
 * @param {string} type - Notification type
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {Object} data - Additional data (will include navigation to Pulse)
 * @returns {Promise<Object>} Result
 */
async function sendNotificationToUser(userId, type, title, body, data = {}, options = {}) {
  try {
    const {
      pushEligible = true,
      skipSignal = false,
      signalPayload = null,
    } = options;

    if (!skipSignal) {
      const { logNotificationSignal } = await import('./notificationLayer.js');
      await logNotificationSignal({
        eventType: type,
        actorId: data?.from_user_id || data?.actor_id || null,
        entityType: data?.ritual_id
          ? 'ritual'
          : data?.venue_id
            ? 'venue'
            : data?.zone_id
              ? 'zone'
              : data?.memory_id
                ? 'memory'
                : null,
        entityId:
          data?.ritual_id ||
          data?.venue_id ||
          data?.zone_id ||
          data?.memory_id ||
          data?.slot_id ||
          null,
        payload: signalPayload || { title, body, ...data },
      });
    }

    const ok = await shouldSendNotification(userId, type);
    if (!ok) {
      logger.debug('Notification skipped by user preference', { userId, type });
      return { success: true, sent: false, reason: 'User preference disabled' };
    }

    const saved = await saveNotification(userId, type, title, body, data);
    const pushSilent = PUSH_SILENT_TYPES.has(type);
    const quiet = await isUserQuietHours(userId, type);
    const allowPush = pushEligible && !pushSilent && !quiet;

    if (!allowPush) {
      return {
        success: true,
        sent: false,
        in_app: true,
        reason: !pushEligible
          ? 'Signal/surface only (no push)'
          : pushSilent
            ? 'Silent in-app only'
            : 'Quiet hours',
        notification_id: saved?.id,
      };
    }

    const tokens = await getUserDeviceTokens(userId);
    
    if (tokens.length === 0) {
      logger.debug('No device tokens found for user', { userId, type });
      return { success: true, sent: false, in_app: true, reason: 'No device tokens' };
    }

    const notificationData = {
      ...data,
      screen: resolvePushScreen(type, data),
      type: type,
    };

    const pushResult = await sendExpoPushNotification(tokens, {
      title,
      body,
      data: notificationData,
    });

    if (saved?.id) {
      await pool.query(
        `UPDATE notifications
         SET is_sent = $2
         WHERE id = $1`,
        [saved.id, pushResult.success === true]
      );
    }

    logger.info('Notification sent to user', { 
      userId, 
      type, 
      sent: pushResult.success,
      tokensCount: tokens.length 
    });

    return {
      success: pushResult.success,
      sent: pushResult.success,
      tokensCount: tokens.length,
    };
  } catch (error) {
    logger.error('Error sending notification to user', { 
      error: error.message, 
      stack: error.stack,
      userId,
      type 
    });
    return { success: false, error: error.message };
  }
}

/**
 * Notification type handlers (per spec 5.7 / §11)
 */

export function resolvePushScreen(type, data = {}) {
  if (data.screen) return data.screen;
  switch (type) {
    case 'share_object':
      return 'Conversation';
    case 'forum_comment':
    case 'forum_repost':
    case 'forum_upvote':
      return 'RitualForum';
    case 'penalty_warning':
    case 'penalty_suspension':
    case 'penalty_host_ban':
    case 'penalty_suspension_end':
    case 'penalty_host_ban_end':
    case 'replacement_invite':
    case 'replacement_result':
    case 'replacement_required':
      return 'NotificationCenter';
    case 'prelobby_message':
      return 'WaitingRoom';
    case 'quote_discussion_invite':
      return 'RitualForum';
    case 'venue_ritual_started':
    case 'venue_ritual_ended':
      return 'VenueManager';
    case 'venue_application_result':
      return data.approved ? 'VenueApply' : 'NotificationCenter';
    case 'venue_suggestion':
    case 'venue_slot_claimed':
      return 'VenueSlots';
    case 'checkin_open':
    case 'door_closing':
    case 'keyword_opened':
    case 'exact_details_unlocked':
    case 'window_opened':
    case 'feedback_closing':
    case 'join_confirmed':
    case 'recurring_instance':
    case 'late_arrival_join':
    case 'ritual_cancelled':
      return 'RitualDetail';
    case 'venue_memory_archived':
      return 'VenueArchive';
    case 'seating_status_change':
      return 'VenueDetail';
    case 'badge_approval':
      return 'BadgeGallery';
    case 'badge_approaching':
      return 'BadgeGallery';
    case 'fl_change':
      return 'FriendsList';
    case 'ds_tier':
      return 'DSUserDashboard';
    case 'public_memory_follow':
      return 'YourMemories';
    case 'memory_soz':
    case 'memory_echo':
    case 'memory_upvote':
    case 'vitrine_selected':
      return 'MemoryDetail';
    case 'zone_liveness':
    case 'zone_spark':
    case 'zone_founder_opportunity':
      return 'ZoneDetail';
    case 'venue_slot_opened':
      return 'VenueSlots';
    case 'followed_host_ritual':
    case 'rare_host_ritual':
      return 'RitualDetail';
    case 'night_report':
    case 'night_report_mini':
      return 'VenueManager';
    case 'regular_gained':
      return 'VenueDetail';
    default:
      return 'Pulse';
  }
}

/** Eşikli upvote bildirimi — milestone geçildi mi? */
export function nextUpvoteNotifyMilestone(currentMilestone, upvotes) {
  const threshold = LOCAL_CONFIG.notifications.FORUM_UPVOTE_THRESHOLD;
  const step = LOCAL_CONFIG.notifications.FORUM_UPVOTE_STEP;
  if (upvotes < threshold) return null;
  const next = currentMilestone > 0 ? currentMilestone + step : threshold;
  if (upvotes >= next && next > currentMilestone) return next;
  return null;
}

async function getUserName(userId) {
  if (!userId) return null;
  try {
    const r = await pool.query(`SELECT name FROM users WHERE id = $1`, [userId]);
    return r.rows[0]?.name || null;
  } catch (_e) {
    return null;
  }
}

async function getRitualMeta(ritualId) {
  if (!ritualId) return null;
  try {
    const ritualResult = await pool.query(
      `SELECT r.id, r.title, r.location_name, r.start_time, r.duration, u.name AS host_name
       FROM rituals r
       LEFT JOIN users u ON u.id = r.host_id
       WHERE r.id = $1
       LIMIT 1`,
      [ritualId]
    );
    return ritualResult.rows[0] || null;
  } catch (_e) {
    return null;
  }
}

async function getApprovedCount(ritualId) {
  if (!ritualId) return 0;
  try {
    const r = await pool.query(
      `SELECT COUNT(*)::int AS c
       FROM ritual_attendance
       WHERE ritual_id = $1
         AND status != 'no_show'
         AND status != 'cancelled'`,
      [ritualId]
    );
    return r.rows[0]?.c || 0;
  } catch (_e) {
    return 0;
  }
}

// "A ritual you might fit just went live" (Spec 5.7 – masked: tap opens Pulse first)
export async function notifyRitualLive(userId, ritualData) {
  const ritualId = ritualData?.id;
  const ritualMeta = await getRitualMeta(ritualId);
  const approvedCount = await getApprovedCount(ritualId);
  const titleText = ritualMeta?.title || ritualData?.title || 'Ritual';
  const hostName = ritualMeta?.host_name || ritualData?.host_name || 'Host';
  return await sendNotificationToUser(
    userId,
    'ritual_reminder',
    'Ritual Hatırlatıcısı',
    `${titleText} 2 saat içinde başlıyor · ${hostName} · ${approvedCount} onayladı`,
    {
      ritual_id: ritualId,
      ritual_title: titleText,
      host_name: hostName,
      approved_count: approvedCount,
    }
  );
}

// "A friend joined a nearby ritual" (§11 B)
export async function notifyFriendJoinedRitual(userId, friendName, ritualData) {
  const titleText = ritualData?.title || 'Ritual';
  return await sendNotificationToUser(
    userId,
    'friend_activity',
    'Arkadas Katildi',
    `${friendName || 'Bir arkadasin'} "${titleText}" Ritualine katildi`,
    { 
      ritual_id: ritualData?.id,
      ritual_title: titleText,
      friend_name: friendName,
      activity: 'friend_joined_ritual',
    }
  );
}

// "A verified venue reopened" (Spec 5.7)
export async function notifyVenueReopened(userId, venueName, ritualData) {
  let venueRitualCount = 0;
  try {
    const cnt = await pool.query(
      `SELECT COUNT(*)::int AS c
       FROM rituals
       WHERE location_name = $1
         AND DATE(start_time) = CURRENT_DATE`,
      [venueName]
    );
    venueRitualCount = cnt.rows[0]?.c || 0;
  } catch (_e) {
    venueRitualCount = 0;
  }
  return await sendNotificationToUser(
    userId,
    'venue_update',
    'Mekan Güncellemesi',
    `${venueName || 'Mekan'} bugün ${venueRitualCount} Rituale ev sahipliği yapıyor · Tümünü gör`,
    {
      ritual_id: ritualData.id,
      ritual_title: ritualData.title,
      venue_name: venueName,
      venue_ritual_count: venueRitualCount,
    }
  );
}

// "You're now friends with [masked name]" (with masked label per spec 5.7)
// friendId is the ID of the new friend (used by app for navigation / profile)
export async function notifyFriendRequestAccepted(userId, friendName, friendId) {
  // Masked label: Use "someone" instead of full name in notification body
  // Full name stored in data for app use
  return await sendNotificationToUser(
    userId,
    'friend_accepted',
    'Arkadaşlık Onayı',
    `${friendName || 'Biri'} ile artık arkadaşsınız`,
    { 
      friend_id: friendId,
      friend_name: friendName, // Full name in data for app use
      masked_label: 'someone' // Masked label for display
    }
  );
}

// "You can now give feedback to each other" (Spec 5.7, 7.8)
export async function notifyFeedbackAvailable(userId, ritualData) {
  const ritualId = ritualData?.id;
  const ritualMeta = await getRitualMeta(ritualId);
  const approvedCount = await getApprovedCount(ritualId);
  let receivedFeedbackCount = 0;
  try {
    const feedbackCount = await pool.query(
      `SELECT COUNT(DISTINCT from_user_id)::int AS c
       FROM feedback
       WHERE ritual_id = $1
         AND to_user_id = $2`,
      [ritualId, userId]
    );
    receivedFeedbackCount = feedbackCount.rows[0]?.c || 0;
  } catch (_e) {
    receivedFeedbackCount = 0;
  }
  const waitingCount = Math.max(0, approvedCount - 1 - receivedFeedbackCount);
  let deadlineHours = 24;
  if (ritualMeta?.start_time && ritualMeta?.duration) {
    const endAt = new Date(new Date(ritualMeta.start_time).getTime() + Number(ritualMeta.duration) * 60000);
    const deadlineAt = new Date(endAt.getTime() + 24 * 3600000);
    const diffMs = deadlineAt.getTime() - Date.now();
    deadlineHours = Math.max(1, Math.ceil(diffMs / 3600000));
  }
  return await sendNotificationToUser(
    userId,
    'feedback_deadline',
    'Geri Bildirim Son Tarihi',
    `${ritualMeta?.title || ritualData?.title || 'Ritual'} · ${waitingCount} kişi bekliyor · ${deadlineHours}s'de son tarih · +IF uyarısı`,
    {
      ritual_id: ritualId,
      ritual_title: ritualMeta?.title || ritualData?.title,
      waiting_count: waitingCount,
      deadline_label: `${deadlineHours}s`,
    }
  );
}

export async function notifyFriendRequest(userId, requesterName, requesterId) {
  return await sendNotificationToUser(
    userId,
    'friend_request',
    'Arkadaşlık İsteği',
    `${requesterName || 'Biri'} bağlanmak istiyor`,
    { sender_id: requesterId, friend_name: requesterName }
  );
}

export async function notifyRSChange(userId, payload = {}) {
  return await sendNotificationToUser(
    userId,
    'rs_change',
    'RS Değişimi',
    `${payload.delta || '+0,09'} · ${payload.ritual_title || 'Ritual'} · ${payload.evaluator_count || 0} değerlendirici · RS detaylarını gör`,
    payload
  );
}

export async function notifyMaturationUpgrade(userId, payload = {}) {
  return await sendNotificationToUser(
    userId,
    'maturation_upgrade',
    'Olgunluk Yükseltmesi',
    "Artık daha fazla LOCAL'sın · Ritual sayısı kilometre taşı",
    payload
  );
}

export async function notifyBadgeEarned(userId, payload = {}) {
  return await sendNotificationToUser(
    userId,
    'badge_earned',
    'Rozet Kazanıldı',
    `${payload.badge_label || 'Rozet'} · ${payload.condition || 'Koşul tamamlandı'}`,
    payload
  );
}

export async function notifyNoShowWarning(userId, payload = {}) {
  return await sendNotificationToUser(
    userId,
    'no_show_warning',
    'Gelmeme Uyarısı',
    `${payload.ritual_title || 'Ritual'} · ${payload.attempt || '1.'} sefer · ${payload.penalty || 'ceza bildirimi'}`,
    payload
  );
}

/** B Sosyal — Share-2-Person nesne geldi (default ON) */
export async function notifyShareObjectReceived({
  toUserId,
  fromUserId,
  objectType,
  objectId,
  shareId,
  note,
}) {
  const fromName = (await getUserName(fromUserId)) || 'Arkadasin';
  const typeLabel = String(objectType || 'paylasim').replace(/_/g, ' ');
  return await sendNotificationToUser(
    toUserId,
    'share_object',
    'Paylasim',
    `${fromName} sana ${typeLabel} gonderdi`,
    {
      from_user_id: fromUserId,
      from_name: fromName,
      object_type: objectType,
      object_id: objectId,
      share_id: shareId,
      note: note || null,
      screen: 'Conversation',
    }
  );
}

/** C Local World — yorum / yanit */
export async function notifyForumComment({
  recipientUserId,
  actorUserId,
  ritualId,
  commentId,
  isReply,
}) {
  if (!recipientUserId || String(recipientUserId) === String(actorUserId)) {
    return { success: true, sent: false, reason: 'self or missing recipient' };
  }
  const actorName = (await getUserName(actorUserId)) || 'Biri';
  const ritualMeta = await getRitualMeta(ritualId);
  return await sendNotificationToUser(
    recipientUserId,
    'forum_comment',
    'Forum',
    isReply
      ? `${actorName} yorumuna yanit verdi`
      : `${actorName} icerigine yorum yapti · ${ritualMeta?.title || 'Ritual'}`,
    {
      ritual_id: ritualId,
      ritual_title: ritualMeta?.title,
      comment_id: commentId,
      actor_user_id: actorUserId,
      screen: 'RitualForum',
    }
  );
}

/** C Local World — repost → Pulse */
export async function notifyForumRepost({
  recipientUserId,
  actorUserId,
  ritualId,
  repostId,
}) {
  if (!recipientUserId || String(recipientUserId) === String(actorUserId)) {
    return { success: true, sent: false, reason: 'self or missing recipient' };
  }
  const actorName = (await getUserName(actorUserId)) || 'Biri';
  const ritualMeta = await getRitualMeta(ritualId);
  return await sendNotificationToUser(
    recipientUserId,
    'forum_repost',
    'Forum Repost',
    `${actorName} ${ritualMeta?.title || 'Ritual'} icerigini Pulse'a tasidi`,
    {
      ritual_id: ritualId,
      ritual_title: ritualMeta?.title,
      repost_id: repostId,
      actor_user_id: actorUserId,
      screen: 'RitualForum',
    }
  );
}

/** C Local World — upvote esik (default OFF) */
export async function notifyForumUpvoteMilestone({
  recipientUserId,
  ritualId,
  commentId,
  upvotes,
  milestone,
}) {
  const ritualMeta = await getRitualMeta(ritualId);
  return await sendNotificationToUser(
    recipientUserId,
    'forum_upvote',
    'Forum',
    `Yorumun ${upvotes} begeni aldi · ${ritualMeta?.title || 'Ritual'}`,
    {
      ritual_id: ritualId,
      ritual_title: ritualMeta?.title,
      comment_id: commentId,
      upvotes,
      milestone,
      screen: 'RitualForum',
    }
  );
}

/** E Ceza — notr ton */
export async function notifyPenaltyWarning(userId, { ritualId, eventType, strike } = {}) {
  const ritualMeta = await getRitualMeta(ritualId);
  const labels = {
    late_cancel: 'Gec iptal kaydi',
    no_show: 'Katilim kaydi',
    host_no_show: 'Host katilim kaydi',
  };
  return await sendNotificationToUser(
    userId,
    'penalty_warning',
    'Katilim Kaydi',
    `${labels[eventType] || 'Kayit'} guncellendi · ${ritualMeta?.title || 'Ritual'} · ${strike || 1}. kayit`,
    { ritual_id: ritualId, event_type: eventType, strike, screen: 'NotificationCenter' }
  );
}

export async function notifyPenaltySuspension(userId, { ritualId, hours, until } = {}) {
  return await sendNotificationToUser(
    userId,
    'penalty_suspension',
    'Katilim Duraklatildi',
    `Ritual katilimin ${hours || '?'} saat duraklatildi · kurallar sayfasindan detay`,
    { ritual_id: ritualId, hours, until, screen: 'NotificationCenter' }
  );
}

export async function notifyPenaltyHostBan(userId, { ritualId, hours, until } = {}) {
  return await sendNotificationToUser(
    userId,
    'penalty_host_ban',
    'Host Erisimi',
    `Host erisimin gecici olarak sinirlandi · ${hours || '?'} saat`,
    { ritual_id: ritualId, hours, until, screen: 'NotificationCenter' }
  );
}

export async function notifyReplacementInvite(userId, { ritualId, slotId } = {}) {
  const ritualMeta = await getRitualMeta(ritualId);
  return await sendNotificationToUser(
    userId,
    'replacement_invite',
    'Yer Acildi',
    `${ritualMeta?.title || 'Ritual'} icin replacement daveti · detaydan incele`,
    { ritual_id: ritualId, slot_id: slotId, screen: 'RitualDetail' }
  );
}

export async function notifyReplacementResult(userId, { ritualId, filled } = {}) {
  const ritualMeta = await getRitualMeta(ritualId);
  return await sendNotificationToUser(
    userId,
    'replacement_result',
    'Replacement',
    filled
      ? `${ritualMeta?.title || 'Ritual'} yerine biri katildi`
      : `${ritualMeta?.title || 'Ritual'} replacement suresi doldu`,
    { ritual_id: ritualId, filled: !!filled, screen: 'RitualDetail' }
  );
}

/** F Venue — başvuru sonucu (§11) */
export async function notifyVenueApplicationResult(userId, { approved, venueId, venueName, city, reviewerNote } = {}) {
  const title = approved ? 'Venue Onaylandi' : 'Venue Basvurusu';
  const body = approved
    ? `${venueName || 'Mekan'} (${city || ''}) onaylandi · vitrin kurulumuna gec`
    : `${venueName || 'Basvuru'} incelendi · ${reviewerNote || 'su an kabul edilmedi'}`;
  return await sendNotificationToUser(
    userId,
    'venue_application_result',
    title,
    body.trim(),
    {
      approved: !!approved,
      venue_id: venueId || null,
      venue_name: venueName,
      city,
      screen: approved ? 'VenueOnboarding' : 'NotificationCenter',
    }
  );
}

/** F Venue — slot onerisi (§9.4 / §11) */
export async function notifyVenueSuggestion(userId, { venueId, suggestionId, title } = {}) {
  return await sendNotificationToUser(
    userId,
    'venue_suggestion',
    'Slot Onerisi',
    `${title || 'Yeni oneri'} · oneri kutusunu incele`,
    { venue_id: venueId, suggestion_id: suggestionId, screen: 'VenueSlots' }
  );
}

/** F Venue — slot kapandi (§9.4) */
export async function notifyVenueSlotClaimed(userId, { venueId, slotId, slotTitle, claimerId } = {}) {
  return await sendNotificationToUser(
    userId,
    'venue_slot_claimed',
    'Slot Kapandi',
    `${slotTitle || 'Slot'} bir kullanici tarafindan kapandi`,
    { venue_id: venueId, slot_id: slotId, claimer_id: claimerId, screen: 'VenueSlots' }
  );
}

/** §11 — exact detaylar acildi */
export async function notifyExactDetailsUnlocked(userId, ritualData = {}) {
  return await sendNotificationToUser(
    userId,
    'exact_details_unlocked',
    'Detaylar Acildi',
    `${ritualData.title || 'Ritual'} · tam konum ve host notlari`,
    { ritual_id: ritualData.id, screen: 'RitualDetail' }
  );
}

/** §11 — feedback kapaniyor */
export async function notifyFeedbackClosing(userId, ritualData = {}) {
  return await sendNotificationToUser(
    userId,
    'feedback_closing',
    'Feedback Kapaniyor',
    `${ritualData.title || 'Ritual'} · geri bildirim Window bitiyor`,
    { ritual_id: ritualData.id, screen: 'RitualDetail' }
  );
}

/** §11 — Ritual iptal */
export async function notifyRitualCancelled(userId, ritualData = {}) {
  return await sendNotificationToUser(
    userId,
    'ritual_cancelled',
    'Ritual Iptal',
    `${ritualData.title || 'Ritual'} host tarafindan iptal edildi`,
    { ritual_id: ritualData.id, screen: 'RitualDetail' }
  );
}

/** §2D — panel [yer veremedik] nötr push (alarm değil) */
export async function notifyVenueNoCapacity(userId, ritualData = {}) {
  return await sendNotificationToUser(
    userId,
    'venue_no_capacity',
    'Masa acilamadi',
    `${ritualData.title || 'Ritual'} icin mekan yer veremedi — cezasiz.`,
    { ritual_id: ritualData.id, venue_id: ritualData.venue_id, screen: 'Pulse' }
  );
}

/** §11 — gec katilimci geldi (host) */
export async function notifyLateArrivalJoin(hostUserId, { ritualData, participantName, minutesLate } = {}) {
  return await sendNotificationToUser(
    hostUserId,
    'late_arrival_join',
    'Gec Katilim',
    `${participantName || 'Katilimci'} check-in yapti (${minutesLate || '?'} dk gec) · ${ritualData?.title || 'Ritual'}`,
    { ritual_id: ritualData?.id, screen: 'RitualDetail' }
  );
}

/** §11 — oturma durumu degisti */
export async function notifySeatingStatusChange(userId, { venueId, venueName, seatingLabel, seatingKey } = {}) {
  if (LOCAL_CONFIG.notifications?.PUSH_DEFAULTS?.seating_status_change === false) {
    return { skipped: true };
  }
  return await sendNotificationToUser(
    userId,
    'seating_status_change',
    'Oturma Durumu',
    `${venueName || 'Mekan'}: ${seatingLabel || seatingKey || 'guncellendi'}`,
    { venue_id: venueId, seating_key: seatingKey, screen: 'VenueDetail' },
    { pushEligible: true }
  );
}

/** §11 — badge onay (venue vitrin) */
export async function notifyBadgeApproval(userId, { venueId, badgeName } = {}) {
  return await sendNotificationToUser(
    userId,
    'badge_approval',
    'Rozet Onayi',
    `${badgeName || 'Rozet'} vitrinde yayinlandi`,
    { venue_id: venueId, screen: 'BadgeGallery' }
  );
}

/** §11 — oneri sonucu (kullaniciya) */
export async function notifySuggestionResolved(userId, { venueId, title, approved, reviewerNote } = {}) {
  return await sendNotificationToUser(
    userId,
    approved ? 'venue_suggestion' : 'venue_update',
    approved ? 'Onerin Onaylandi' : 'Onerin Reddedildi',
    approved
      ? `"${title || 'Oneri'}" slot olarak acildi`
      : `"${title || 'Oneri'}" · ${reviewerNote || 'su an uygun degil'}`,
    { venue_id: venueId, approved: !!approved, screen: 'VenueSlots' }
  );
}

/** §11 — Ritual Window acildi */
export async function notifyWindowOpened(userId, ritualData = {}) {
  return await sendNotificationToUser(
    userId,
    'window_opened',
    'Window Acildi',
    `${ritualData.title || 'Ritual'} · memory ve forum aktif`,
    { ritual_id: ritualData.id, screen: 'RitualDetail' }
  );
}

/** v2 §2 — masa açıldı (firstSeal / ritual_opened) */
export async function notifyRitualOpened(ritualRow = {}, { openNote = null } = {}) {
  const ritualId = ritualRow.id;
  const title = ritualRow.title || 'Ritual';
  const note = openNote || ritualRow.open_note;
  const body = note
    ? `${title} · masa yaşıyor — ${String(note).slice(0, 120)}`
    : `${title} · masa yaşıyor`;
  const regs = await pool.query(
    `SELECT user_id FROM ritual_attendance
     WHERE ritual_id = $1 AND status NOT IN ('no_show', 'cancelled')`,
    [ritualId]
  );
  const venueManagers = ritualRow.venue_id
    ? await pool.query(`SELECT user_id FROM venue_managers WHERE venue_id = $1`, [ritualRow.venue_id])
    : { rows: [] };
  const targets = new Set([
    ...regs.rows.map((r) => String(r.user_id || '')),
    ...venueManagers.rows.map((r) => String(r.user_id || '')),
  ]);
  for (const uid of targets) {
    if (!uid) continue;
    await sendNotificationToUser(uid, 'ritual_opened', 'Masa Acildi', body, {
      ritual_id: ritualId,
      screen: 'RitualCheckIn',
      prelobby_open_card: true,
      venue_panel_signal: true,
    }).catch(() => {});
  }
}

/** §11 — anahtar kelime acildi */
export async function notifyKeywordOpened(userId, ritualData = {}) {
  return await sendNotificationToUser(
    userId,
    'keyword_opened',
    'Anahtar Kelime Acildi',
    `${ritualData.title || 'Ritual'} · check-in yapabilirsin`,
    { ritual_id: ritualData.id, screen: 'RitualDetail' }
  );
}

/** v2 §2 — emanet anahtar teklifi KALDIRILDI (firstSeal); no-op */
export async function notifyKeywordEscrowOffer(_userId, _ritualData = {}) {
  return { ok: false, skipped: true, reason: 'ESCROW_REMOVED' };
}

/** §11 — check-in acildi (Ritual LIVE) */
export async function notifyCheckinOpen(userId, ritualData = {}) {
  return await sendNotificationToUser(
    userId,
    'checkin_open',
    'Check-in Acildi',
    `${ritualData.title || 'Ritual'} basladi`,
    { ritual_id: ritualData.id, screen: 'RitualDetail' }
  );
}

/** §11 — kapı kapaniyor */
export async function notifyDoorClosing(userId, ritualData = {}) {
  return await sendNotificationToUser(
    userId,
    'door_closing',
    'Kapi Kapaniyor',
    `${ritualData.title || 'Ritual'} · son check-in firsati`,
    { ritual_id: ritualData.id, screen: 'RitualDetail' }
  );
}

/** §11 — katilim onaylandi */
export async function notifyJoinConfirmed(userId, ritualData = {}) {
  return await sendNotificationToUser(
    userId,
    'join_confirmed',
    'Katilim Onaylandi',
    `${ritualData.title || 'Ritual'} listesine eklendin`,
    { ritual_id: ritualData.id, screen: 'RitualDetail' }
  );
}

/** §11 — tekrarlayan Ritual instance */
export async function notifyRecurringInstance(userId, ritualData = {}) {
  return await sendNotificationToUser(
    userId,
    'recurring_instance',
    'Seri',
    `${ritualData.title || 'Ritual'} · yeni tarih hazir`,
    { ritual_id: ritualData.id, screen: 'RitualDetail' }
  );
}

/** §11 — venue memory arsive eklendi */
export async function notifyVenueMemoryArchived(userId, { venueId, venueName, memoryId } = {}) {
  return await sendNotificationToUser(
    userId,
    'venue_memory_archived',
    'Mekan Arsivi',
    `${venueName || 'Mekan'} arsivine yeni anı eklendi`,
    { venue_id: venueId, memory_id: memoryId, screen: 'VenueArchive' }
  );
}

/** B Sosyal — prelobby mesaji (5dk debounce / alici) */
export async function notifyPrelobbyMessage(recipientUserId, {
  ritualId,
  senderUserId,
  senderName,
  preview,
} = {}) {
  if (!recipientUserId || String(recipientUserId) === String(senderUserId)) {
    return { success: true, sent: false, reason: 'self or missing recipient' };
  }
  const recent = await pool.query(
    `SELECT 1 FROM notifications
     WHERE user_id = $1 AND type = 'prelobby_message'
       AND data->>'ritual_id' = $2
       AND created_at > NOW() - INTERVAL '5 minutes'
     LIMIT 1`,
    [recipientUserId, String(ritualId)]
  );
  if (recent.rows.length > 0) {
    return { success: true, sent: false, reason: 'debounced' };
  }
  const ritualMeta = await getRitualMeta(ritualId);
  const snippet = String(preview || '').trim().slice(0, 80);
  return await sendNotificationToUser(
    recipientUserId,
    'prelobby_message',
    'Prelobby',
    `${senderName || 'Biri'} · ${ritualMeta?.title || 'Ritual'}${snippet ? `: ${snippet}` : ''}`,
    {
      ritual_id: ritualId,
      sender_user_id: senderUserId,
      screen: 'WaitingRoom',
    }
  );
}

/** C Local World — quote discussion daveti */
export async function notifyQuoteDiscussionInvite({
  recipientUserId,
  actorUserId,
  ritualId,
  commentId,
  memoryId,
}) {
  if (!recipientUserId || String(recipientUserId) === String(actorUserId)) {
    return { success: true, sent: false, reason: 'self or missing recipient' };
  }
  const actorName = (await getUserName(actorUserId)) || 'Biri';
  const ritualMeta = await getRitualMeta(ritualId);
  return await sendNotificationToUser(
    recipientUserId,
    'quote_discussion_invite',
    'Quote Tartismasi',
    `${actorName} alintina yorum yapti · ${ritualMeta?.title || 'Ritual'}`,
    {
      ritual_id: ritualId,
      comment_id: commentId,
      memory_id: memoryId,
      actor_user_id: actorUserId,
      screen: 'RitualForum',
    }
  );
}

/** E Ceza — aski / host-ban bitisi */
export async function notifyPenaltySuspensionEnd(userId) {
  return await sendNotificationToUser(
    userId,
    'penalty_suspension_end',
    'Katilim Durumu',
    'Ritual katilim duraklatman sona erdi · yeniden katilabilirsin',
    { screen: 'NotificationCenter' }
  );
}

export async function notifyPenaltyHostBanEnd(userId) {
  return await sendNotificationToUser(
    userId,
    'penalty_host_ban_end',
    'Host Erisimi',
    'Host erisim sinirlaman sona erdi · yeniden Ritual acabilirsin',
    { screen: 'NotificationCenter' }
  );
}

/** E Ceza — replacement zorunlu */
export async function notifyReplacementRequired(userId, { ritualId, slotId } = {}) {
  const ritualMeta = await getRitualMeta(ritualId);
  return await sendNotificationToUser(
    userId,
    'replacement_required',
    'Replacement Gerekli',
    `${ritualMeta?.title || 'Ritual'} · yerine biri bulunmazsa gec iptal kaydi olusur`,
    { ritual_id: ritualId, slot_id: slotId, screen: 'RitualDetail' }
  );
}

/** F Venue — Ritual basladi / bitti */
export async function notifyVenueRitualStarted(userId, { venueId, venueName, ritualId, ritualTitle } = {}) {
  return await sendNotificationToUser(
    userId,
    'venue_ritual_started',
    'Mekan Rituali',
    `${venueName || 'Mekan'} · ${ritualTitle || 'Ritual'} canli basladi`,
    { venue_id: venueId, ritual_id: ritualId, screen: 'VenueManager' }
  );
}

export async function notifyVenueRitualEnded(userId, { venueId, venueName, ritualId, ritualTitle } = {}) {
  return await sendNotificationToUser(
    userId,
    'venue_ritual_ended',
    'Mekan Rituali',
    `${venueName || 'Mekan'} · ${ritualTitle || 'Ritual'} arsive gecti`,
    { venue_id: venueId, ritual_id: ritualId, screen: 'VenueManager' }
  );
}

export async function notifyVenueManagers(venueId, notifyFn, payload = {}) {
  if (!venueId) return { notified: 0 };
  const managers = await pool.query(
    `SELECT user_id FROM venue_managers WHERE venue_id = $1`,
    [venueId]
  );
  let notified = 0;
  for (const row of managers.rows) {
    await notifyFn(row.user_id, payload).catch(() => {});
    notified += 1;
  }
  return { notified };
}

/** D — badge yaklastin (yalnız sahibine push: "2 ritüel kaldı") */
export async function notifyBadgeApproaching(userId, { slug, name, progress_pct, next_level, remaining_rituals } = {}) {
  const key = String(slug || '').trim();
  if (!key) return { success: true, sent: false };
  const dup = await pool.query(
    `SELECT 1 FROM notifications
     WHERE user_id = $1 AND type = 'badge_approaching'
       AND data->>'slug' = $2
       AND created_at > NOW() - INTERVAL '7 days'
     LIMIT 1`,
    [userId, key]
  );
  if (dup.rows.length > 0) return { success: true, sent: false, reason: 'deduped' };
  const left = remaining_rituals != null ? Number(remaining_rituals) : 2;
  return await sendNotificationToUser(
    userId,
    'badge_approaching',
    'Rozete Yaklastin',
    `${name || key} · ${left} ritüel kaldı`,
    {
      slug: key,
      badge_name: name,
      progress_pct,
      next_level,
      remaining_rituals: left,
      screen: 'BadgeGallery',
    }
  );
}

/** B — FL degisimi (sessiz / in-app) */
export async function notifyFlChange(userId, { friendId, friendName, oldLevel, newLevel } = {}) {
  return await sendNotificationToUser(
    userId,
    'fl_change',
    'Baglanti Seviyesi',
    `${friendName || 'Arkadas'} · ${oldLevel || '?'} → ${newLevel || '?'}`,
    { friend_id: friendId, friend_name: friendName, old_level: oldLevel, new_level: newLevel, screen: 'FriendsList' }
  );
}

/** D — DS tier (private / in-app) */
export async function notifyDsTierPrivate(userId, { oldTier, newTier, tierLabel } = {}) {
  return await sendNotificationToUser(
    userId,
    'ds_tier',
    'DS Seviyesi',
    `DS tier: ${tierLabel || newTier || 'guncellendi'} (${oldTier || '?'} → ${newTier || '?'})`,
    { old_tier: oldTier, new_tier: newTier, tier_label: tierLabel, screen: 'DSUserDashboard' }
  );
}

/** C — takip ettigin public memory (sessiz / in-app) */
export async function notifyPublicMemoryFollow(followerUserId, { creatorId, creatorName, memoryId, ritualId } = {}) {
  if (!followerUserId || String(followerUserId) === String(creatorId)) {
    return { success: true, sent: false, reason: 'self' };
  }
  return await sendNotificationToUser(
    followerUserId,
    'public_memory_follow',
    'Takip Ettigin Ani',
    `${creatorName || 'Takip ettigin biri'} yeni bir public ani paylasti`,
    {
      creator_id: creatorId,
      creator_name: creatorName,
      memory_id: memoryId,
      ritual_id: ritualId,
      screen: 'YourMemories',
    }
  );
}

export async function notifyPublicMemoryFollowers(creatorId, { memoryId, ritualId, creatorName } = {}) {
  const followers = await pool.query(
    `SELECT follower_id FROM follows WHERE following_id = $1`,
    [creatorId]
  );
  let notified = 0;
  for (const row of followers.rows) {
    const r = await notifyPublicMemoryFollow(row.follower_id, {
      creatorId,
      creatorName,
      memoryId,
      ritualId,
    }).catch(() => ({ sent: false }));
    if (r?.in_app || r?.sent) notified += 1;
  }
  return { notified };
}

/** F6 Live Activity — ambient data push */
export async function pushLiveActivityUpdate(userId, payload = {}) {
  try {
    const tokens = await getUserDeviceTokens(userId);
    if (tokens.length === 0) {
      return { success: true, sent: false, reason: 'No device tokens' };
    }
    const messages = tokens.map((token) => ({
      to: token,
      priority: 'high',
      channelId: 'live_activity',
      data: {
        type: 'live_activity_update',
        screen: 'RitualDetail',
        ritual_id: payload.ritual_id || null,
        ...payload,
      },
      _contentAvailable: true,
    }));
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });
    const result = await response.json();
    return { success: true, sent: true, result };
  } catch (error) {
    logger.error('pushLiveActivityUpdate failed', { userId, error: error.message });
    return { success: false, error: error.message };
  }
}

/** v2 §13 — Söz / Yankı (downvote never pushed) */
export async function notifyMemorySoz(ownerUserId, { memoryId, fromUserId } = {}) {
  if (!LOCAL_CONFIG.notifications?.PUSH_DEFAULTS?.memory_soz) return { skipped: true };
  return sendNotificationToUser(
    ownerUserId,
    'memory_soz',
    'Yeni Söz',
    'Anına bir Söz bırakıldı',
    { memory_id: memoryId, from_user_id: fromUserId, screen: 'MemoryDetail' }
  );
}

/** Sosyal §7 — mention bildirim merkezine düşer; push kategori tercihine bağlı */
export async function notifyMention(toUserId, { fromUserId, sourceType, sourceId, ritualId } = {}) {
  let actorName = 'Birisi';
  if (fromUserId) {
    const u = await pool.query(`SELECT name FROM users WHERE id = $1`, [fromUserId]);
    if (u.rows[0]?.name) actorName = u.rows[0].name;
  }
  return sendNotificationToUser(
    toUserId,
    'mention',
    'Mention',
    `${actorName} seni etiketledi`,
    {
      from_user_id: fromUserId,
      source_type: sourceType,
      source_id: sourceId,
      ritual_id: ritualId,
      screen: ritualId ? 'LiveRitual' : 'Notifications',
    }
  );
}

export async function notifyMemoryEcho(ownerUserId, { memoryId, fromUserId } = {}) {
  if (!LOCAL_CONFIG.notifications?.PUSH_DEFAULTS?.memory_echo) return { skipped: true };
  let actorName = 'Birisi';
  if (fromUserId) {
    const u = await pool.query(`SELECT name FROM users WHERE id = $1`, [fromUserId]);
    if (u.rows[0]?.name) actorName = u.rows[0].name;
  }
  return sendNotificationToUser(
    ownerUserId,
    'memory_echo',
    'Yankı',
    `${actorName} yankıladı`,
    { memory_id: memoryId, from_user_id: fromUserId, screen: 'MemoryDetail' }
  );
}

/** v2 §8 — rare-host: follower gets push only if host idle ≥ RARE_HOST_D days */
export async function notifyRareHostFollowers(hostId, ritual) {
  if (!LOCAL_CONFIG.notifications?.PUSH_DEFAULTS?.rare_host) return { skipped: true };
  const days = LOCAL_CONFIG.follow?.RARE_HOST_D ?? 60;

  const last = await pool.query(
    `SELECT MAX(start_time) AS last_at FROM rituals
     WHERE host_id = $1 AND id != $2 AND status::text NOT IN ('cancelled', 'draft', 'created')`,
    [hostId, ritual?.id]
  );
  const lastAt = last.rows[0]?.last_at ? new Date(last.rows[0].last_at) : null;
  const rare =
    !lastAt || Date.now() - lastAt.getTime() >= days * 24 * 3600 * 1000;
  if (!rare) return { skipped: true, reason: 'not_rare' };

  const followers = await pool.query(
    `SELECT f.follower_id, f.bell
     FROM follows f
     WHERE f.following_id = $1`,
    [hostId]
  );
  let sent = 0;
  for (const row of followers.rows) {
    await sendNotificationToUser(
      row.follower_id,
      'rare_host_ritual',
      'Nadir host açtı',
      ritual?.title || 'Takip ettiğin biri Ritual açtı',
      { ritual_id: ritual?.id, host_id: hostId, screen: 'RitualDetail' }
    ).catch(() => {});
    sent += 1;
  }
  return { ok: true, sent };
}

/** Ordinary followed-host ritual: push ONLY if follower opted into bell; feed signal separate */
export async function notifyFollowedHostBell(hostId, ritual) {
  const { logNotificationSignal } = await import('./notificationLayer.js');
  await logNotificationSignal({
    eventType: 'followed_host_ritual',
    actorId: hostId,
    entityType: 'ritual',
    entityId: ritual?.id,
    payload: { host_id: hostId, title: ritual?.title },
  });
  if (!LOCAL_CONFIG.notifications?.PUSH_DEFAULTS?.followed_host_ritual) {
    return { skipped: true, reason: 'push_default_off', signal: true };
  }
  const hostRow = await pool.query(`SELECT name FROM users WHERE id = $1`, [hostId]);
  const followers = await pool.query(
    `SELECT f.follower_id
     FROM follows f
     WHERE f.following_id = $1 AND COALESCE(f.bell, false) = true`,
    [hostId]
  );
  let sent = 0;
  for (const row of followers.rows) {
    await sendNotificationToUser(
      row.follower_id,
      'followed_host_ritual',
      'Takip ettiğin host açtı',
      ritual?.title || hostRow.rows[0]?.name || 'Yeni Ritual',
      { ritual_id: ritual?.id, host_id: hostId, screen: 'RitualDetail' },
      { pushEligible: true, skipSignal: true }
    ).catch(() => {});
    sent += 1;
  }
  return { ok: true, sent, signal: true };
}

export async function notifyNightReport(venueOwnerId, report) {
  if (!LOCAL_CONFIG.notifications?.PUSH_DEFAULTS?.night_report) return { skipped: true };
  return sendNotificationToUser(
    venueOwnerId,
    'night_report',
    'Gece Raporu hazır',
    `${report?.date || 'Bugün'} · raporda seni bekliyor`,
    { venue_id: report?.venue_id, screen: 'VenueManager' }
  );
}

/** Ritual biter bitmez mini sinyal — digest gece tek push ayrı */
export async function notifyNightReportMiniSignal(venueManagerId, { venueId, ritualId, ritualTitle } = {}) {
  return sendNotificationToUser(
    venueManagerId,
    'night_report_mini',
    'Raporda seni bekliyor',
    ritualTitle ? `${ritualTitle} · gece digest'te` : 'Bu geceki kırılım raporda seni bekliyor',
    { venue_id: venueId, ritual_id: ritualId, screen: 'VenueManager', tab: 'gece' }
  );
}

export async function notifyVenueTakeover(userId, { venueId, until } = {}) {
  return sendNotificationToUser(
    userId,
    'venue_takeover',
    'LOCAL TAKEOVER aktif',
    until ? `24s · ${new Date(until).toLocaleString('tr-TR')}` : 'Slot limiti kalktı · keşif işareti açık',
    { venue_id: venueId, screen: 'VenueManager', tab: 'business' }
  );
}

export async function notifyRegularGainedVenue(venueManagerUserId, { venueId, userId } = {}) {
  if (!LOCAL_CONFIG.notifications?.PUSH_DEFAULTS?.regular_gained_venue) return { skipped: true };
  return sendNotificationToUser(
    venueManagerUserId,
    'regular_gained',
    'Yeni Regular',
    'Bir kullanıcı Regular oldu',
    { venue_id: venueId, user_id: userId },
    { pushEligible: true }
  );
}

/** §13 — vitrine seçildin (memory owner) */
export async function notifyVitrineSelected(ownerUserId, { memoryId, venueId, venueName } = {}) {
  if (!LOCAL_CONFIG.notifications?.PUSH_DEFAULTS?.vitrine_selected) return { skipped: true };
  if (!ownerUserId) return { skipped: true };
  return sendNotificationToUser(
    ownerUserId,
    'vitrine_selected',
    'Vitrine seçildin',
    venueName ? `${venueName} vitrinine seçildin` : 'Anın vitrine seçildi',
    { memory_id: memoryId, venue_id: venueId, screen: 'MemoryDetail' },
    { pushEligible: true }
  );
}

/** §13 — memory upvote eşikli */
export async function notifyMemoryUpvoteMilestone(ownerUserId, { memoryId, upvotes, milestone } = {}) {
  if (!LOCAL_CONFIG.notifications?.PUSH_DEFAULTS?.memory_upvote_milestone) return { skipped: true };
  if (!ownerUserId) return { skipped: true };
  return sendNotificationToUser(
    ownerUserId,
    'memory_upvote',
    'Anın yükseliyor',
    `${upvotes || milestone} ▲ · eşik geçildi`,
    { memory_id: memoryId, upvotes, milestone, screen: 'MemoryDetail' },
    { pushEligible: true }
  );
}

/** §13 — slot açıldı → venue zil takipçileri */
export async function notifyVenueSlotOpened(venueId, { slotId, slotTitle, venueName } = {}) {
  if (!LOCAL_CONFIG.notifications?.PUSH_DEFAULTS?.venue_slot_opened) return { skipped: true };
  const { logNotificationSignal, listVenueBellFollowerIds } = await import('./notificationLayer.js');
  await logNotificationSignal({
    eventType: 'venue_slot_opened',
    entityType: 'venue',
    entityId: venueId,
    payload: { slot_id: slotId, slot_title: slotTitle },
  });
  const ids = await listVenueBellFollowerIds(venueId);
  let sent = 0;
  for (const uid of ids) {
    await sendNotificationToUser(
      uid,
      'venue_slot_opened',
      'Slot açıldı',
      slotTitle || venueName || 'Takip ettiğin mekanda yeni slot',
      { venue_id: venueId, slot_id: slotId, screen: 'VenueSlots' },
      { pushEligible: true, skipSignal: true }
    ).catch(() => {});
    sent += 1;
  }
  return { ok: true, sent };
}

/** §13 — zone canlılık (Ritual live) → zil takipçileri */
export async function notifyZoneLiveness(zoneId, { ritualId, ritualTitle, zoneName } = {}) {
  if (!LOCAL_CONFIG.notifications?.PUSH_DEFAULTS?.zone_liveness) return { skipped: true };
  const { logNotificationSignal, listZoneBellFollowerIds } = await import('./notificationLayer.js');
  await logNotificationSignal({
    eventType: 'zone_liveness',
    entityType: 'zone',
    entityId: zoneId,
    payload: { ritual_id: ritualId },
  });
  const ids = await listZoneBellFollowerIds(zoneId);
  let sent = 0;
  for (const uid of ids) {
    await sendNotificationToUser(
      uid,
      'zone_liveness',
      'Zone canlandı',
      ritualTitle || zoneName || 'Takip ettiğin zone’da Ritual',
      { zone_id: zoneId, ritual_id: ritualId, screen: 'ZoneDetail' },
      { pushEligible: true, skipSignal: true }
    ).catch(() => {});
    sent += 1;
  }
  return { ok: true, sent };
}

/** §13 — SPARK başladı / büyüdü */
export async function notifyZoneSpark(zoneId, { meetupId, memberCount, zoneName, actorId } = {}) {
  if (!LOCAL_CONFIG.notifications?.PUSH_DEFAULTS?.zone_spark) return { skipped: true };
  const { logNotificationSignal, listZoneBellFollowerIds } = await import('./notificationLayer.js');
  await logNotificationSignal({
    eventType: 'zone_spark',
    actorId,
    entityType: 'zone',
    entityId: zoneId,
    payload: { meetup_id: meetupId, member_count: memberCount },
  });
  const ids = await listZoneBellFollowerIds(zoneId);
  let sent = 0;
  for (const uid of ids) {
    if (actorId && String(uid) === String(actorId)) continue;
    await sendNotificationToUser(
      uid,
      'zone_spark',
      'SPARK',
      `${memberCount || 1} kişi · ${zoneName || 'zone'}`,
      { zone_id: zoneId, meetup_id: meetupId, screen: 'ZoneDetail' },
      { pushEligible: true, skipSignal: true }
    ).catch(() => {});
    sent += 1;
  }
  return { ok: true, sent };
}

/** §13 — founder fırsatı (SPARK ready → instant Ritual doğabilir) */
export async function notifyZoneFounderOpportunity(userIds, { zoneId, meetupId, zoneName } = {}) {
  if (!LOCAL_CONFIG.notifications?.PUSH_DEFAULTS?.zone_founder_opportunity) return { skipped: true };
  const { logNotificationSignal } = await import('./notificationLayer.js');
  await logNotificationSignal({
    eventType: 'zone_founder_opportunity',
    entityType: 'zone',
    entityId: zoneId,
    payload: { meetup_id: meetupId },
  });
  const uniq = [...new Set((userIds || []).filter(Boolean))];
  let sent = 0;
  for (const uid of uniq) {
    await sendNotificationToUser(
      uid,
      'zone_founder_opportunity',
      'Founder fırsatı',
      zoneName
        ? `${zoneName}: SPARK doldu — Rituali sen doğurabilirsin`
        : 'SPARK doldu — Rituali sen doğurabilirsin',
      { zone_id: zoneId, meetup_id: meetupId, screen: 'CreateRitual' },
      { pushEligible: true, skipSignal: true }
    ).catch(() => {});
    sent += 1;
  }
  return { ok: true, sent };
}

/**
 * sonMD Sosyal §2 — haftalık digest (default ON, kapatılabilir).
 * FOMO yok: yaklaşan kaydedilmiş/Series + yakındaki uygun + arkadaş açtığı.
 */
export async function sendWeeklyDigests({ limit = 500 } = {}) {
  if (LOCAL_CONFIG.notifications?.PUSH_DEFAULTS?.weekly_digest === false) {
    return { skipped: true };
  }
  const users = await pool.query(
    `SELECT u.id
     FROM users u
     LEFT JOIN user_settings us ON us.user_id = u.id
     WHERE COALESCE(us.notify_weekly_digest, true) = true
     ORDER BY u.created_at DESC
     LIMIT $1`,
    [limit]
  );
  let sent = 0;
  for (const row of users.rows) {
    await sendNotificationToUser(
      row.id,
      'weekly_digest',
      'Haftalık özet',
      'Yaklaşan kaydettiklerin, yakındaki masalar ve arkadaşının açtıkları — kaçırma dili yok.',
      { screen: 'Local', digest: 'weekly' },
      { pushEligible: true, skipSignal: true }
    ).catch(() => {});
    sent += 1;
  }
  return { ok: true, sent };
}

// Export utility functions
export {
  registerDeviceToken,
  unregisterDeviceToken,
  getUserDeviceTokens,
  saveNotification,
  sendNotificationToUser,
};
