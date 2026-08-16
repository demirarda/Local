/**
 * Share-2-Person — son-part.md §8.3 (nesne zorunlu, sadece arkadaşlar)
 */
import pool from '../config/database.js';
import LOCAL_CONFIG from '../config/localConfig.js';
import { getAcceptedFriendship } from './friendshipLevel.js';
import { notifyShareObjectReceived } from './notifications.js';

const NOTE_MAX = LOCAL_CONFIG.content.SHARE_NOTE_MAX_CHARS;

/** Mekan / davet nesneleri — public node, serbest paylaşım */
const PUBLIC_NODE_TYPES = new Set([
  'venue_invite',
  'ritual_send',
  'friend_joining',
  'reaction_geliyorum',
  'reaction_baktim',
]);

/** Kişi nesneleri — yalnızca PUBLIC bırakılanlar paylaşılabilir */
const PERSON_BOUND_TYPES = new Set([
  'memory',
  'quote',
  'photo',
  'forward',
  'quote_challenge',
  'playlist',
  'badge',
  'passport',
  'forum_thread',
  'forum_repost',
]);

const RS_DS_PAYLOAD_KEYS = new Set([
  'rs_score',
  'ds_score',
  'ds_ema',
  'rs_visible',
  'ds_tier',
  'regular_label',
  'is_regular',
]);

export async function assertFriends(userA, userB) {
  const f = await getAcceptedFriendship(userA, userB);
  if (!f) return { ok: false, error: 'Share-2-Person is friends-only' };
  return { ok: true };
}

export function validateSharePayload({ objectType, objectId, note }) {
  if (!objectType) {
    return { ok: false, error: 'object_type is required' };
  }
  if (!objectId && !PUBLIC_NODE_TYPES.has(objectType)) {
    return { ok: false, error: 'object_id is required for this object_type' };
  }
  const trimmedNote = note != null ? String(note).trim() : '';
  if (!objectId && trimmedNote && !PUBLIC_NODE_TYPES.has(objectType)) {
    return { ok: false, error: 'Note-only messages are not allowed' };
  }
  if (trimmedNote.length > NOTE_MAX) {
    return { ok: false, error: `note max ${NOTE_MAX} characters` };
  }
  return { ok: true, note: trimmedNote || null };
}

function memoryIsPublicForShare(row) {
  const privacy = String(row.privacy || '').toLowerCase();
  const dest = String(row.destination || '').toLowerCase();
  return (
    privacy === 'public' ||
    dest === 'ritual_and_pulse' ||
    String(row.memory_type || '') === 'pulse'
  );
}

export function sanitizeSharePayload(payload = {}) {
  if (!payload || typeof payload !== 'object') return {};
  const clean = { ...payload };
  for (const key of RS_DS_PAYLOAD_KEYS) {
    delete clean[key];
  }
  return clean;
}

/**
 * son-part.md §8.3 — kişi nesneleri yalnızca PUBLIC; RS/DS/Regular/private memory ASLA
 */
export async function assertShareableObject(fromUserId, objectType, objectId) {
  if (PUBLIC_NODE_TYPES.has(objectType)) {
    return { ok: true };
  }

  if (!objectId) {
    return { ok: false, error: 'object_id is required for this object_type' };
  }

  if (!PERSON_BOUND_TYPES.has(objectType)) {
    return { ok: true };
  }

  switch (objectType) {
    case 'memory':
    case 'quote':
    case 'photo':
    case 'quote_challenge':
    case 'playlist':
    case 'forward': {
      const r = await pool.query(
        `SELECT user_id, privacy, destination, memory_type, type
         FROM memories WHERE id = $1`,
        [objectId]
      );
      if (r.rows.length === 0) {
        return { ok: false, error: 'Memory not found' };
      }
      const mem = r.rows[0];
      if (String(mem.user_id) !== String(fromUserId)) {
        return { ok: false, error: 'Can only share your own memories' };
      }
      if (!memoryIsPublicForShare(mem)) {
        return {
          ok: false,
          error: 'Only PUBLIC memories can be shared (private/friends-only blocked)',
        };
      }
      return { ok: true };
    }
    case 'badge': {
      const r = await pool.query(
        `SELECT user_id FROM user_badges WHERE id = $1`,
        [objectId]
      );
      if (r.rows.length === 0) {
        return { ok: false, error: 'Badge not found' };
      }
      if (String(r.rows[0].user_id) !== String(fromUserId)) {
        return { ok: false, error: 'Can only share your own badges' };
      }
      return { ok: true };
    }
    case 'passport': {
      if (String(objectId) !== String(fromUserId)) {
        return { ok: false, error: 'Passport share is self-only public snapshot' };
      }
      const settings = await pool.query(
        `SELECT public_profile FROM user_settings WHERE user_id = $1`,
        [fromUserId]
      );
      if (settings.rows[0]?.public_profile === false) {
        return {
          ok: false,
          error: 'Enable public profile before sharing passport',
        };
      }
      return { ok: true };
    }
    case 'forum_thread':
    case 'forum_repost': {
      const table = objectType === 'forum_thread' ? 'forum_comments' : 'pulse_reposts';
      const r = await pool.query(`SELECT id FROM ${table} WHERE id = $1`, [objectId]);
      if (r.rows.length === 0) {
        return { ok: false, error: 'Forum object not found' };
      }
      return { ok: true };
    }
    default:
      return { ok: true };
  }
}

export async function listShareableObjects(userId, { type = 'memory', limit = 20 } = {}) {
  const lim = Math.min(Number(limit) || 20, 50);

  if (type === 'memory' || type === 'quote') {
    const r = await pool.query(
      `SELECT id, content, memory_type, type, created_at, ritual_id,
              destination::text AS destination, privacy::text AS privacy
       FROM memories
       WHERE user_id = $1
         AND (
           privacy::text = 'public'
           OR destination::text = 'ritual_and_pulse'
           OR memory_type = 'pulse'
         )
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, lim]
    );
    return {
      ok: true,
      objects: r.rows.map((row) => ({
        id: row.id,
        object_type: row.type === 'quote' ? 'quote' : 'memory',
        label: String(row.content || '').slice(0, 80),
        ritual_id: row.ritual_id,
        created_at: row.created_at,
      })),
    };
  }

  if (type === 'badge') {
    const r = await pool.query(
      `SELECT id, badge_key, badge_label, awarded_at
       FROM user_badges WHERE user_id = $1
       ORDER BY awarded_at DESC NULLS LAST
       LIMIT $2`,
      [userId, lim]
    );
    return {
      ok: true,
      objects: r.rows.map((row) => ({
        id: row.id,
        object_type: 'badge',
        label: row.badge_label || row.badge_key,
        created_at: row.awarded_at,
      })),
    };
  }

  return { ok: false, status: 400, error: 'Unsupported shareable type' };
}

export async function sendShareObject({
  fromUserId,
  toUserId,
  objectType,
  objectId = null,
  note = null,
  payload = {},
}) {
  if (String(fromUserId) === String(toUserId)) {
    return { ok: false, status: 400, error: 'Cannot share to yourself' };
  }

  const friendCheck = await assertFriends(fromUserId, toUserId);
  if (!friendCheck.ok) return { ok: false, status: 403, error: friendCheck.error };

  const valid = validateSharePayload({ objectType, objectId, note });
  if (!valid.ok) return { ok: false, status: 400, error: valid.error };

  const shareable = await assertShareableObject(fromUserId, objectType, objectId);
  if (!shareable.ok) {
    return { ok: false, status: 403, error: shareable.error };
  }

  const safePayload = sanitizeSharePayload(payload);

  const r = await pool.query(
    `INSERT INTO share_objects (from_user_id, to_user_id, object_type, object_id, note, payload)
     VALUES ($1, $2, $3::share_object_type, $4, $5, $6::jsonb)
     RETURNING *`,
    [fromUserId, toUserId, objectType, objectId, valid.note, JSON.stringify(safePayload || {})]
  );

  notifyShareObjectReceived({
    toUserId,
    fromUserId,
    objectType,
    objectId,
    shareId: r.rows[0].id,
    note: valid.note,
  }).catch(() => {});

  return { ok: true, share: r.rows[0] };
}

export async function listShareObjects(userId, withUserId, { limit = 50 } = {}) {
  const friendCheck = await assertFriends(userId, withUserId);
  if (!friendCheck.ok) return { ok: false, status: 403, error: friendCheck.error };

  const r = await pool.query(
    `SELECT s.*,
            fu.name AS from_name,
            tu.name AS to_name
     FROM share_objects s
     JOIN users fu ON fu.id = s.from_user_id
     JOIN users tu ON tu.id = s.to_user_id
     WHERE (s.from_user_id = $1 AND s.to_user_id = $2)
        OR (s.from_user_id = $2 AND s.to_user_id = $1)
     ORDER BY s.created_at DESC
     LIMIT $3`,
    [userId, withUserId, Math.min(Number(limit) || 50, 200)]
  );

  return {
    ok: true,
    shares: r.rows.map((row) => ({
      ...row,
      is_mine: String(row.from_user_id) === String(userId),
    })),
  };
}

export async function listShareInbox(userId, { limit = 30 } = {}) {
  const r = await pool.query(
    `SELECT s.*, fu.name AS from_name, fu.avatar_url AS from_avatar
     FROM share_objects s
     JOIN users fu ON fu.id = s.from_user_id
     WHERE s.to_user_id = $1
     ORDER BY s.created_at DESC
     LIMIT $2`,
    [userId, Math.min(Number(limit) || 30, 100)]
  );
  return r.rows;
}
