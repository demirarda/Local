/**
 * sonMD Wave B — weather cancel, collaborator, FB eligibility, saves/mutes, audience helpers
 */
import pool from '../config/database.js';
import LOCAL_CONFIG, { getCategorySoftCap } from '../config/localConfig.js';

// ─── Memory audience ───

export function toAudience(raw) {
  const map = LOCAL_CONFIG.memory_audience?.LEGACY_MAP || {
    solo: 'WINDOW',
    pulse: 'CIRCLE',
    all: 'CITY',
  };
  const values = LOCAL_CONFIG.memory_audience?.VALUES || ['WINDOW', 'CIRCLE', 'CITY'];
  const s = String(raw || '').toUpperCase();
  if (values.includes(s)) return s;
  const lower = String(raw || '').toLowerCase();
  if (map[lower]) return map[lower];
  return LOCAL_CONFIG.memory_audience?.DEFAULT || 'WINDOW';
}

export function audienceToLegacyScope(audience) {
  const a = toAudience(audience);
  if (a === 'CITY') return 'all';
  if (a === 'CIRCLE') return 'pulse';
  return 'solo';
}

// ─── Weather cancel ───

export function isWeatherCancelEligible(ritual, now = new Date()) {
  const cfg = LOCAL_CONFIG.weather_cancel || {};
  if (cfg.ENABLED === false) return { ok: false, reason: 'disabled' };

  const start = ritual?.start_time ? new Date(ritual.start_time) : null;
  if (!start || Number.isNaN(start.getTime())) {
    return { ok: false, reason: 'no_start' };
  }
  const hours = Number(cfg.WINDOW_HOURS_BEFORE_START ?? 3);
  const windowOpenAt = new Date(start.getTime() - hours * 3600000);
  if (now < windowOpenAt) {
    return { ok: false, reason: 'too_early', window_opens_at: windowOpenAt.toISOString() };
  }
  if (now > start) {
    return { ok: false, reason: 'already_started' };
  }

  const keys = cfg.CATEGORY_KEYS || [];
  const soft = getCategorySoftCap(ritual?.category_label || ritual?.category || ritual?.title);
  const outdoorByCategory = keys.includes(soft.key);
  const isZone =
    Boolean(cfg.ZONE_TABLES_ELIGIBLE) &&
    String(ritual?.location_type || '').toLowerCase() === 'zone';

  if (!outdoorByCategory && !isZone) {
    return { ok: false, reason: 'not_outdoor_category', category_key: soft.key };
  }

  return { ok: true, category_key: soft.key, is_zone: isZone };
}

export async function recordWeatherCancelSignal({ hostId, ritualId, categoryKey }) {
  await pool.query(
    `INSERT INTO weather_cancel_signals (host_id, ritual_id, category_key)
     VALUES ($1, $2, $3)`,
    [hostId, ritualId, categoryKey || null]
  );
  const cfg = LOCAL_CONFIG.weather_cancel || {};
  const windowD = Number(cfg.MOD_SIGNAL_WINDOW_D || 90);
  const threshold = Number(cfg.MOD_SIGNAL_THRESHOLD || 3);
  const cnt = await pool.query(
    `SELECT COUNT(*)::int AS c FROM weather_cancel_signals
     WHERE host_id = $1 AND created_at > NOW() - ($2 || ' days')::interval`,
    [hostId, String(windowD)]
  );
  const n = Number(cnt.rows[0]?.c || 0);
  return { count: n, mod_signal: n >= threshold, threshold, window_d: windowD };
}

/**
 * Host cancel ritual — weather_cancel is penalty-free when eligible.
 */
export async function cancelRitualAsHost({ ritualId, hostId, reason = 'host_cancel', categoryLabel }) {
  const r = await pool.query(
    `SELECT id, host_id, title, start_time, status, location_type, origin, zone_id
     FROM rituals WHERE id = $1`,
    [ritualId]
  );
  if (!r.rows[0]) return { ok: false, status: 404, error: 'Ritual not found' };
  const ritual = r.rows[0];
  if (String(ritual.host_id) !== String(hostId)) {
    return { ok: false, status: 403, error: 'Only host can cancel ritual' };
  }
  if (String(ritual.status) === 'cancelled') {
    return { ok: true, already: true, ritual };
  }

  let cancelReason = String(reason || 'host_cancel').slice(0, 32);
  let weatherMeta = null;
  if (cancelReason === 'weather_cancel') {
    const gate = isWeatherCancelEligible({ ...ritual, category_label: categoryLabel });
    if (!gate.ok) {
      return {
        ok: false,
        status: 400,
        error: 'Weather cancel not eligible',
        code: 'WEATHER_CANCEL_INELIGIBLE',
        detail: gate,
      };
    }
    weatherMeta = await recordWeatherCancelSignal({
      hostId,
      ritualId,
      categoryKey: gate.category_key,
    });
  }

  await pool.query(
    `UPDATE rituals
     SET status = 'cancelled',
         cancel_reason = $2,
         cancelled_at = NOW(),
         cancelled_by = $3,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [ritualId, cancelReason, hostId]
  );

  return {
    ok: true,
    ritual: { ...ritual, status: 'cancelled', cancel_reason: cancelReason },
    weather: weatherMeta,
    penalty_free: cancelReason === 'weather_cancel',
  };
}

// ─── Collaborators ───

export async function addCollaborator({ scope, scopeId, userId, invitedBy, permissions }) {
  const allowed = LOCAL_CONFIG.collaborator?.ALLOWED_SCOPES || [];
  if (!allowed.includes(scope)) {
    return { ok: false, status: 400, error: 'Collaborator only for series/event_group/venue_event' };
  }
  const perms =
    Array.isArray(permissions) && permissions.length
      ? permissions.filter((p) => (LOCAL_CONFIG.collaborator?.PERMISSIONS || []).includes(p))
      : LOCAL_CONFIG.collaborator?.PERMISSIONS || ['announce'];

  const ins = await pool.query(
    `INSERT INTO organizers_collaborators (scope, scope_id, user_id, invited_by, permissions, status)
     VALUES ($1::collaborator_scope, $2, $3, $4, $5, 'active')
     ON CONFLICT (scope, scope_id, user_id) DO UPDATE
       SET status = 'active', permissions = EXCLUDED.permissions
     RETURNING *`,
    [scope, scopeId, userId, invitedBy || null, perms]
  );
  return { ok: true, collaborator: ins.rows[0] };
}

export async function listCollaborators(scope, scopeId) {
  const r = await pool.query(
    `SELECT c.*, u.name, u.avatar_url
     FROM organizers_collaborators c
     JOIN users u ON u.id = c.user_id
     WHERE c.scope = $1::collaborator_scope AND c.scope_id = $2 AND c.status = 'active'
     ORDER BY c.created_at ASC`,
    [scope, scopeId]
  );
  return r.rows;
}

export async function canAnnounce({ ritualId, userId }) {
  const ritual = await pool.query(
    `SELECT host_id, series_id, event_group_id, origin, venue_id
     FROM rituals WHERE id = $1`,
    [ritualId]
  );
  if (!ritual.rows[0]) return false;
  const row = ritual.rows[0];
  if (String(row.host_id) === String(userId)) return true;

  if (row.series_id) {
    const c = await pool.query(
      `SELECT 1 FROM organizers_collaborators
       WHERE scope = 'series' AND scope_id = $1 AND user_id = $2 AND status = 'active'
         AND 'announce' = ANY(permissions)
       LIMIT 1`,
      [row.series_id, userId]
    );
    if (c.rows.length) return true;
  }
  if (row.event_group_id) {
    const c = await pool.query(
      `SELECT 1 FROM organizers_collaborators
       WHERE scope = 'event_group' AND scope_id = $1 AND user_id = $2 AND status = 'active'
         AND 'announce' = ANY(permissions)
       LIMIT 1`,
      [row.event_group_id, userId]
    );
    if (c.rows.length) return true;
  }
  if (String(row.origin || '') === 'VEN_EVENT' && row.venue_id) {
    const c = await pool.query(
      `SELECT 1 FROM organizers_collaborators
       WHERE scope = 'venue_event' AND scope_id = $1 AND user_id = $2 AND status = 'active'
         AND 'announce' = ANY(permissions)
       LIMIT 1`,
      [row.venue_id, userId]
    );
    if (c.rows.length) return true;
  }
  return false;
}

// ─── Account privacy / follow request ───

export async function getAccountPrivacy(userId) {
  const r = await pool.query(
    `SELECT COALESCE(account_privacy, 'OPEN') AS account_privacy
     FROM user_settings WHERE user_id = $1`,
    [userId]
  );
  return r.rows[0]?.account_privacy || LOCAL_CONFIG.account_privacy?.DEFAULT || 'OPEN';
}

export async function isApprovedFollower(viewerId, targetId) {
  if (!viewerId || !targetId) return false;
  if (String(viewerId) === String(targetId)) return true;
  const r = await pool.query(
    `SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2 LIMIT 1`,
    [viewerId, targetId]
  );
  return r.rows.length > 0;
}

export async function requestOrFollow({ fromUserId, toUserId, bell = false }) {
  if (String(fromUserId) === String(toUserId)) {
    return { ok: false, status: 400, error: 'Cannot follow yourself' };
  }
  const privacy = await getAccountPrivacy(toUserId);
  if (privacy === 'CLOSED' && LOCAL_CONFIG.account_privacy?.CLOSED_FOLLOW_REQUIRES_APPROVAL !== false) {
    const existing = await pool.query(
      `SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2`,
      [fromUserId, toUserId]
    );
    if (existing.rows.length) {
      return { ok: true, mode: 'already_following' };
    }
    const reqIns = await pool.query(
      `INSERT INTO follow_requests (from_user_id, to_user_id, status)
       VALUES ($1, $2, 'pending')
       ON CONFLICT (from_user_id, to_user_id) DO UPDATE
         SET status = 'pending', resolved_at = NULL, created_at = NOW()
       RETURNING *`,
      [fromUserId, toUserId]
    );
    return { ok: true, mode: 'request', request: reqIns.rows[0] };
  }

  const ins = await pool.query(
    `INSERT INTO follows (follower_id, following_id, bell)
     VALUES ($1, $2, $3)
     ON CONFLICT (follower_id, following_id) DO UPDATE SET bell = EXCLUDED.bell
     RETURNING *`,
    [fromUserId, toUserId, Boolean(bell)]
  );
  return { ok: true, mode: 'follow', follow: ins.rows[0] };
}

export async function resolveFollowRequest({ requestId, toUserId, accept }) {
  const r = await pool.query(
    `SELECT * FROM follow_requests WHERE id = $1 AND to_user_id = $2 AND status = 'pending'`,
    [requestId, toUserId]
  );
  if (!r.rows[0]) return { ok: false, status: 404, error: 'Request not found' };
  const req = r.rows[0];
  if (!accept) {
    await pool.query(
      `UPDATE follow_requests SET status = 'declined', resolved_at = NOW() WHERE id = $1`,
      [requestId]
    );
    return { ok: true, mode: 'declined', silent: true };
  }
  await pool.query('BEGIN');
  try {
    await pool.query(
      `UPDATE follow_requests SET status = 'accepted', resolved_at = NOW() WHERE id = $1`,
      [requestId]
    );
    await pool.query(
      `INSERT INTO follows (follower_id, following_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [req.from_user_id, req.to_user_id]
    );
    await pool.query('COMMIT');
  } catch (e) {
    await pool.query('ROLLBACK');
    throw e;
  }
  return { ok: true, mode: 'accepted', from_user_id: req.from_user_id };
}

// ─── FB eligibility snapshot ───

/**
 * Normal masa: tüm mühürlüler co_presence.
 * VEN_EVENT: yalnız aynı sub'da zaman-kesişenler (sub_seal) — main-komşusu kişi-FB yok.
 */
export async function snapshotFeedbackEligibility(ritualId, sealedUserId) {
  const ritualR = await pool.query(
    `SELECT id, origin, event_group_id FROM rituals WHERE id = $1`,
    [ritualId]
  );
  const ritual = ritualR.rows[0];
  const isVenEvent =
    String(ritual?.origin || '') === 'VEN_EVENT' || Boolean(ritual?.event_group_id);

  if (isVenEvent) {
    // Aktif/ geçmiş sub varlıklarından kesişimleri yaz
    const subs = await pool.query(
      `SELECT DISTINCT sub_id FROM ritual_event_sub_seals
       WHERE ritual_id = $1 AND actor_user_id = $2`,
      [ritualId, sealedUserId]
    );
    let peers = 0;
    if (subs.rows.length > 0) {
      const { refreshSubSealFeedbackEligibility } = await import('./eventSubSealService.js');
      for (const s of subs.rows) {
        const r = await refreshSubSealFeedbackEligibility(ritualId, sealedUserId, s.sub_id);
        peers += Number(r?.peers || 0);
      }
    }
    // Main-only mühür: kişi-FB eligibility YOK (tag/arkadaşlık yolu feedback kapısından ayrı)
    return { peers, mode: 'ven_event_sub_only', main_only: subs.rows.length === 0 };
  }

  const peers = await pool.query(
    `SELECT user_id FROM ritual_attendance
     WHERE ritual_id = $1
       AND checkin_at IS NOT NULL
       AND COALESCE(checkin_phase, 'sealed') = 'sealed'
       AND user_id <> $2
       AND status::text NOT IN ('no_show', 'cancelled')`,
    [ritualId, sealedUserId]
  );
  for (const row of peers.rows) {
    const a = sealedUserId;
    const b = row.user_id;
    await pool.query(
      `INSERT INTO feedback_eligibility (ritual_id, from_user_id, to_user_id, source)
       VALUES ($1, $2, $3, 'co_presence'), ($1, $3, $2, 'co_presence')
       ON CONFLICT (ritual_id, from_user_id, to_user_id) DO NOTHING`,
      [ritualId, a, b]
    );
  }
  return { peers: peers.rows.length, mode: 'co_presence' };
}

export async function hasFeedbackEligibility(ritualId, fromUserId, toUserId) {
  const r = await pool.query(
    `SELECT 1 FROM feedback_eligibility
     WHERE ritual_id = $1 AND from_user_id = $2 AND to_user_id = $3
     LIMIT 1`,
    [ritualId, fromUserId, toUserId]
  );
  return r.rows.length > 0;
}

// ─── Saves / mutes ───

export async function saveObject({ userId, objectType, objectId }) {
  const types = LOCAL_CONFIG.saves?.OBJECT_TYPES || [];
  if (!types.includes(objectType)) {
    return { ok: false, status: 400, error: 'Invalid object_type' };
  }
  const ins = await pool.query(
    `INSERT INTO user_saves (user_id, object_type, object_id)
     VALUES ($1, $2::save_object_type, $3)
     ON CONFLICT (user_id, object_type, object_id) DO NOTHING
     RETURNING *`,
    [userId, objectType, objectId]
  );
  return { ok: true, save: ins.rows[0] || null, already: !ins.rows[0] };
}

export async function unsaveObject({ userId, objectType, objectId }) {
  await pool.query(
    `DELETE FROM user_saves WHERE user_id = $1 AND object_type = $2::save_object_type AND object_id = $3`,
    [userId, objectType, objectId]
  );
  return { ok: true };
}

export async function listSaves(userId) {
  const r = await pool.query(
    `SELECT * FROM user_saves WHERE user_id = $1 ORDER BY created_at DESC LIMIT 200`,
    [userId]
  );
  return r.rows;
}

export async function muteObject({ userId, objectType, objectId = null, objectKey = null }) {
  const types = LOCAL_CONFIG.mutes?.OBJECT_TYPES || [];
  if (!types.includes(objectType)) {
    return { ok: false, status: 400, error: 'Invalid object_type' };
  }
  const ins = await pool.query(
    `INSERT INTO user_mutes (user_id, object_type, object_id, object_key)
     VALUES ($1, $2::mute_object_type, $3, $4)
     RETURNING *`,
    [userId, objectType, objectId, objectKey]
  );
  return { ok: true, mute: ins.rows[0] };
}

export async function unmuteObject({ userId, muteId }) {
  await pool.query(`DELETE FROM user_mutes WHERE id = $1 AND user_id = $2`, [muteId, userId]);
  return { ok: true };
}

// ─── Chat edit / reactions ───

export async function editChatMessage({ messageId, userId, content }) {
  const winMin = Number(LOCAL_CONFIG.messaging?.EDIT_WINDOW_MIN || 5);
  const r = await pool.query(`SELECT * FROM chat_messages WHERE id = $1`, [messageId]);
  if (!r.rows[0]) return { ok: false, status: 404, error: 'Message not found' };
  const msg = r.rows[0];
  if (String(msg.user_id) !== String(userId)) {
    return { ok: false, status: 403, error: 'Only author can edit' };
  }
  if (msg.deleted_at) {
    return { ok: false, status: 400, error: 'Message deleted' };
  }
  const created = new Date(msg.created_at);
  if (Date.now() - created.getTime() > winMin * 60 * 1000) {
    return { ok: false, status: 400, error: 'Edit window closed', code: 'EDIT_WINDOW_CLOSED' };
  }
  const text = String(content || '').trim().slice(0, 2000);
  if (!text) return { ok: false, status: 400, error: 'Empty content' };
  const upd = await pool.query(
    `UPDATE chat_messages SET content = $2, edited_at = NOW() WHERE id = $1 RETURNING *`,
    [messageId, text]
  );
  return { ok: true, message: upd.rows[0] };
}

export async function softDeleteChatMessage({ messageId, userId }) {
  const r = await pool.query(`SELECT * FROM chat_messages WHERE id = $1`, [messageId]);
  if (!r.rows[0]) return { ok: false, status: 404, error: 'Message not found' };
  if (String(r.rows[0].user_id) !== String(userId)) {
    return { ok: false, status: 403, error: 'Only author can delete' };
  }
  const upd = await pool.query(
    `UPDATE chat_messages
     SET content = '', deleted_at = NOW(), edited_at = COALESCE(edited_at, NOW())
     WHERE id = $1 RETURNING *`,
    [messageId]
  );
  return { ok: true, message: upd.rows[0] };
}

export async function setChatReaction({ messageId, userId, emoji }) {
  const allowed = LOCAL_CONFIG.messaging?.REACTIONS || [];
  if (!allowed.includes(emoji)) {
    return { ok: false, status: 400, error: 'Invalid reaction', allowed };
  }
  const msg = await pool.query(`SELECT id FROM chat_messages WHERE id = $1 AND deleted_at IS NULL`, [
    messageId,
  ]);
  if (!msg.rows[0]) return { ok: false, status: 404, error: 'Message not found' };

  const ins = await pool.query(
    `INSERT INTO chat_message_reactions (message_id, user_id, emoji)
     VALUES ($1, $2, $3)
     ON CONFLICT (message_id, user_id) DO UPDATE SET emoji = EXCLUDED.emoji, created_at = NOW()
     RETURNING *`,
    [messageId, userId, emoji]
  );
  const tally = await pool.query(
    `SELECT emoji, COUNT(*)::int AS n FROM chat_message_reactions WHERE message_id = $1 GROUP BY emoji`,
    [messageId]
  );
  await pool.query(
    `UPDATE chat_messages SET reaction_count = (
       SELECT COUNT(*)::int FROM chat_message_reactions WHERE message_id = $1
     ) WHERE id = $1`,
    [messageId]
  );
  return { ok: true, reaction: ins.rows[0], tallies: tally.rows };
}
