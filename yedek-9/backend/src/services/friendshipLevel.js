/**
 * Friend Level (FL) — 24 Ağu mühür-bazlı
 * Counter unit = ortak mühür (co_seal), taze 12 ay. FB-sayacı emekli.
 */
import pool from '../config/database.js';
import LOCAL_CONFIG, { levelFromCoSealCount, fbWeightFromLevel } from '../config/localConfig.js';

const PEER_FEEDBACK_TYPES = ['p2p', 'p2host'];

export { levelFromCoSealCount, levelFromCoSealCount as levelFromFbCount, fbWeightFromLevel };

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

export async function countFreshCoSealsBetween(userA, userB, client = pool) {
  const months = LOCAL_CONFIG.fl.FRESHNESS_MONTHS;
  try {
    const r = await client.query(
      `SELECT COUNT(*)::int AS c
       FROM friendship_co_seals s
       WHERE (
           (s.user_a = $1 AND s.user_b = $2)
           OR (s.user_a = $2 AND s.user_b = $1)
         )
         AND s.created_at >= NOW() - ($3::text || ' months')::interval`,
      [userA, userB, String(months)]
    );
    return r.rows[0]?.c ?? 0;
  } catch (_e) {
    const friendship = await getAcceptedFriendship(userA, userB);
    return Number(friendship?.co_seal_count || 0);
  }
}

/** @deprecated FL artık co-seal; kalibrasyon logu için FB sayımı duruyor */
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
  const sealCount = await countFreshCoSealsBetween(userA, userB, client);
  const level = levelFromCoSealCount(sealCount);
  return {
    fb_count: sealCount,
    co_seal_count: sealCount,
    friendship_level: level,
    rs_weight: fbWeightFromLevel(level, sealCount),
  };
}

async function persistFlFromSeals(userA, userB, client = pool) {
  const friendship = await getAcceptedFriendship(userA, userB);
  if (!friendship) return null;

  const meta = await getFlMetaForPair(userA, userB, client);
  const levelEnum = meta.friendship_level === 'stranger' ? 'stranger' : meta.friendship_level;
  const prevLevel = friendship.friendship_level;

  let updated;
  try {
    updated = await client.query(
      `UPDATE friendships
       SET co_seal_count = $2,
           friendship_level = $3::friendship_level_enum,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [friendship.id, meta.co_seal_count, levelEnum]
    );
  } catch (_e) {
    updated = await client.query(
      `UPDATE friendships
       SET friendship_level = $2::friendship_level_enum,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [friendship.id, levelEnum]
    );
  }

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
 * Ortak mühür: aynı ritüelde iki accepted-arkadaş mühürlendiğinde atomik kayıt.
 */
export async function applyCoSealOnCheckin(ritualId, userId, client = pool) {
  const others = await client.query(
    `SELECT ra.user_id
     FROM ritual_attendance ra
     INNER JOIN friendships fr ON fr.status = 'accepted'
       AND (
         (fr.requester_id = $2 AND fr.receiver_id = ra.user_id)
         OR (fr.receiver_id = $2 AND fr.requester_id = ra.user_id)
       )
     WHERE ra.ritual_id = $1
       AND ra.user_id <> $2
       AND ra.checkin_at IS NOT NULL
       AND COALESCE(ra.checkin_phase, 'sealed') = 'sealed'`,
    [ritualId, userId]
  );

  const updates = [];
  for (const row of others.rows) {
    const otherId = row.user_id;
    const a = String(userId) < String(otherId) ? userId : otherId;
    const b = String(userId) < String(otherId) ? otherId : userId;
    try {
      await client.query(
        `INSERT INTO friendship_co_seals (user_a, user_b, ritual_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_a, user_b, ritual_id) DO NOTHING`,
        [a, b, ritualId]
      );
    } catch (_e) {
      /* table may be missing pre-migration */
    }
    const meta = await persistFlFromSeals(userId, otherId, client);
    if (meta) updates.push(meta);
  }
  return { updated_pairs: updates.length, pairs: updates };
}

export async function recomputeFlForPair(userA, userB, client = pool) {
  return persistFlFromSeals(userA, userB, client);
}

export async function applyFlOnPeerFeedback(fromUserId, toUserId, client = pool) {
  return persistFlFromSeals(fromUserId, toUserId, client);
}

export async function applyFriendshipLevelOnCheckin(ritualId, userId, client = pool) {
  return applyCoSealOnCheckin(ritualId, userId, client);
}
