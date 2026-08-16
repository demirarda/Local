/**
 * sonMD §2D — transparent window reader presence (anonymous reader_count).
 * Live table write remains attendance-gated.
 */
import pool from '../config/database.js';
import LOCAL_CONFIG from '../config/localConfig.js';

const TTL_S = Number(LOCAL_CONFIG.window_readers?.TTL_S ?? 120);

export async function touchWindowReader(ritualId, userId) {
  if (!ritualId || !userId) return { reader_count: 0 };
  await pool.query(
    `INSERT INTO ritual_window_readers (ritual_id, user_id, last_seen_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (ritual_id, user_id)
     DO UPDATE SET last_seen_at = NOW()`,
    [ritualId, userId]
  );
  // prune stale
  await pool.query(
    `DELETE FROM ritual_window_readers
     WHERE ritual_id = $1
       AND last_seen_at < NOW() - ($2 || ' seconds')::interval`,
    [ritualId, String(TTL_S)]
  );
  return { reader_count: await countActiveReaders(ritualId) };
}

export async function countActiveReaders(ritualId) {
  const r = await pool.query(
    `SELECT COUNT(*)::int AS c
     FROM ritual_window_readers
     WHERE ritual_id = $1
       AND last_seen_at >= NOW() - ($2 || ' seconds')::interval`,
    [ritualId, String(TTL_S)]
  );
  return Number(r.rows[0]?.c || 0);
}

export function readerTtlSeconds() {
  return TTL_S;
}
