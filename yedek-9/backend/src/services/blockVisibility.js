/**
 * Block visibility — sonMD Sosyal §3
 * Block = tam içerik duvarı (keşif / forum / LW memory / mesaj).
 * Join engellenmez; yalnız blocklayan "bu masada blokladığın biri var" uyarısını görür.
 */
import pool from '../config/database.js';

/** İki yönlü block var mı? */
export async function isBlockedEitherWay(userId, otherId) {
  if (!userId || !otherId || String(userId) === String(otherId)) return false;
  const result = await pool.query(
    `SELECT 1 FROM blocks
     WHERE (blocker_id = $1 AND blocked_user_id = $2)
        OR (blocker_id = $2 AND blocked_user_id = $1)
     LIMIT 1`,
    [userId, otherId]
  );
  return result.rows.length > 0;
}

/**
 * Viewer'ın gizlemesi gereken peer id seti (blocker veya blocked olarak).
 * @returns {Promise<Set<string>>}
 */
export async function blockedPeerIds(viewerId) {
  const set = new Set();
  if (!viewerId) return set;
  const result = await pool.query(
    `SELECT blocked_user_id AS peer_id FROM blocks WHERE blocker_id = $1
     UNION
     SELECT blocker_id AS peer_id FROM blocks WHERE blocked_user_id = $1`,
    [viewerId]
  );
  for (const row of result.rows) {
    if (row.peer_id) set.add(String(row.peer_id));
  }
  return set;
}

/**
 * SQL fragment: exclude authors blocked either way with viewer.
 * @param {string} userCol e.g. 'm.user_id' or 'u.id'
 * @param {number} paramIndex 1-based next $n
 * @returns {{ sql: string, params: string[], nextIndex: number }}
 */
export function excludeBlockedUsersSql(userCol, viewerId, paramIndex) {
  if (!viewerId) {
    return { sql: '', params: [], nextIndex: paramIndex };
  }
  const sql = ` AND NOT EXISTS (
    SELECT 1 FROM blocks b
    WHERE (b.blocker_id = $${paramIndex} AND b.blocked_user_id = ${userCol})
       OR (b.blocked_user_id = $${paramIndex} AND b.blocker_id = ${userCol})
  )`;
  return { sql, params: [viewerId], nextIndex: paramIndex + 1 };
}

/**
 * Join öncesi: viewer'ın bu ritüelde blockladığı (yalnız blocker→blocked) katılımcı var mı?
 * Blocklanan tarafa sinyal yok — sadece blocker görür.
 */
export async function hasBlockedPeerOnRitual(viewerId, ritualId) {
  if (!viewerId || !ritualId) return false;
  const result = await pool.query(
    `SELECT 1
     FROM ritual_attendance ra
     JOIN blocks b ON b.blocker_id = $1 AND b.blocked_user_id = ra.user_id
     WHERE ra.ritual_id = $2
       AND ra.status NOT IN ('cancelled', 'no_show', 'left')
     LIMIT 1`,
    [viewerId, ritualId]
  );
  return result.rows.length > 0;
}

/** In-memory filter for already-fetched rows with user_id */
export function filterBlockedAuthors(rows, blockedIds, userIdKey = 'user_id') {
  if (!blockedIds?.size) return rows;
  return rows.filter((row) => !blockedIds.has(String(row[userIdKey])));
}
