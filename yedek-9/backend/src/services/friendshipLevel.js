/**
 * Friend Level (FL) — son-part.md §4.2
 * Counter unit = peer feedback events (p2p/p2host), fresh within FL_FRESHNESS months.
 */
import pool from '../config/database.js';
import LOCAL_CONFIG, { levelFromFbCount, fbWeightFromLevel } from '../config/localConfig.js';

const PEER_FEEDBACK_TYPES = ['p2p', 'p2host'];

export { levelFromFbCount, fbWeightFromLevel };

export async function getAcceptedFriendship(userA, userB) {
  const r = await pool.query(
    `SELECT *
     FROM friendships
     WHERE status = 'accepted'
       AND (
         (requester_id = $1 AND receiver_id = $2)
         OR (requester_id = $2 AND receiver_id = $1)
       )
     LIMIT 1`,
    [userA, userB]
  );
  return r.rows[0] || null;
}

export async function countFreshFeedbackBetween(userA, userB, client = pool) {
  const months = LOCAL_CONFIG.fl.FRESHNESS_MONTHS;
  const r = await client.query(
    `SELECT COUNT(*)::int AS c
     FROM feedback f
     INNER JOIN friendships fr ON fr.status = 'accepted'
       AND (
         (fr.requester_id = $1 AND fr.receiver_id = $2)
         OR (fr.requester_id = $2 AND fr.receiver_id = $1)
       )
     WHERE f.feedback_type = ANY($3::text[])
       AND f.created_at >= COALESCE(fr.first_feedback_at, fr.accepted_at, fr.created_at)
       AND f.created_at >= fr.accepted_at
       AND f.created_at >= NOW() - ($4::text || ' months')::interval
       AND (
         (f.from_user_id = $1 AND f.to_user_id = $2)
         OR (f.from_user_id = $2 AND f.to_user_id = $1)
       )`,
    [userA, userB, PEER_FEEDBACK_TYPES, String(months)]
  );
  return r.rows[0]?.c ?? 0;
}

export async function getFlMetaForPair(userA, userB, client = pool) {
  const fbCount = await countFreshFeedbackBetween(userA, userB, client);
  const level = levelFromFbCount(fbCount);
  return {
    fb_count: fbCount,
    friendship_level: level,
    rs_weight: fbWeightFromLevel(level),
  };
}

/**
 * Recompute and persist FL on friendships row after a peer feedback event.
 */
export async function recomputeFlForPair(userA, userB, client = pool) {
  const friendship = await getAcceptedFriendship(userA, userB);
  if (!friendship) return null;

  const meta = await getFlMetaForPair(userA, userB, client);
  const levelEnum = meta.friendship_level === 'stranger' ? 'stranger' : meta.friendship_level;
  const prevLevel = friendship.friendship_level;

  const updated = await client.query(
    `UPDATE friendships
     SET fb_count = $2,
         friendship_level = $3::friendship_level_enum,
         last_feedback_at = CURRENT_TIMESTAMP,
         first_feedback_at = COALESCE(first_feedback_at, CURRENT_TIMESTAMP),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING *`,
    [friendship.id, meta.fb_count, levelEnum]
  );

  if (prevLevel && levelEnum && prevLevel !== levelEnum) {
    const { notifyFlChange } = await import('./notifications.js');
    const names = await client.query(
      `SELECT id, name FROM users WHERE id = ANY($1::uuid[])`,
      [[userA, userB]]
    );
    const nameMap = new Map(names.rows.map((r) => [String(r.id), r.name]));
    await notifyFlChange(userA, {
      friendId: userB,
      friendName: nameMap.get(String(userB)),
      oldLevel: prevLevel,
      newLevel: levelEnum,
    }).catch(() => {});
    await notifyFlChange(userB, {
      friendId: userA,
      friendName: nameMap.get(String(userA)),
      oldLevel: prevLevel,
      newLevel: levelEnum,
    }).catch(() => {});
  }

  return {
    ...meta,
    friendship: updated.rows[0] || friendship,
  };
}

/**
 * Called after a new p2p/p2host feedback insert (not updates).
 */
export async function applyFlOnPeerFeedback(fromUserId, toUserId, client = pool) {
  return recomputeFlForPair(fromUserId, toUserId, client);
}

/**
 * @deprecated FL advances on feedback only (§4.2) — check-in no longer mutates FL.
 */
export async function applyFriendshipLevelOnCheckin() {
  return { updated_pairs: 0, badge_updates: 0 };
}
