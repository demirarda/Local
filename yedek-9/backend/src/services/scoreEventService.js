/**
 * son-part1.md §2 — score_events append-only log
 */
import pool from '../config/database.js';
import { LOCAL_CONFIG_VERSION } from '../config/localConfig.js';

/**
 * @param {object} params
 * @param {string} params.userId
 * @param {string|null} [params.ritualId]
 * @param {string} params.eventType
 * @param {number|null} [params.delta]
 * @param {object} [params.inputs]
 * @param {object} [params.breakdown]
 */
export async function logScoreEvent({
  userId,
  ritualId = null,
  eventType,
  delta = null,
  inputs = {},
  breakdown = {},
}) {
  if (!userId || !eventType) return;
  try {
    await pool.query(
      `INSERT INTO score_events (user_id, ritual_id, event_type, delta, inputs, breakdown, config_version)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7)`,
      [
        userId,
        ritualId,
        eventType,
        delta,
        JSON.stringify(inputs || {}),
        JSON.stringify(breakdown || {}),
        LOCAL_CONFIG_VERSION,
      ]
    );
  } catch (e) {
    if (e.code !== '42P01') {
      console.error('score_events insert failed:', e.message);
    }
  }
}

export async function listScoreEventsForUser(userId, { limit = 50 } = {}) {
  const r = await pool.query(
    `SELECT id, user_id, ritual_id, event_type, delta, inputs, breakdown, config_version, created_at
     FROM score_events
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, Math.min(Number(limit) || 50, 200)]
  );
  return r.rows;
}

export default { logScoreEvent, listScoreEventsForUser };
