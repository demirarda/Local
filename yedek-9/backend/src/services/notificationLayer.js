/**
 * §13 3-katman: SİNYAL → YÜZEY → PUSH
 * Push yalnız: doğrudan ilgilendiriyorsa VEYA zil açıksa
 */
import pool from '../config/database.js';
import logger from '../utils/logger.js';

export async function logNotificationSignal({
  eventType,
  actorId = null,
  entityType = null,
  entityId = null,
  payload = {},
} = {}) {
  try {
    await pool.query(
      `INSERT INTO notification_signals (event_type, actor_id, entity_type, entity_id, payload)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [
        String(eventType || 'unknown'),
        actorId || null,
        entityType || null,
        entityId != null ? String(entityId) : null,
        JSON.stringify(payload || {}),
      ]
    );
  } catch (e) {
    logger.debug('notification_signals insert skipped', { error: e.message, eventType });
  }
}

export async function listVenueBellFollowerIds(venueId) {
  const r = await pool
    .query(
      `SELECT user_id FROM venue_follows
       WHERE venue_id = $1 AND COALESCE(bell, false) = true`,
      [venueId]
    )
    .catch(() => ({ rows: [] }));
  return r.rows.map((row) => row.user_id);
}

export async function listZoneBellFollowerIds(zoneId) {
  const r = await pool
    .query(
      `SELECT user_id FROM zone_follows
       WHERE zone_id = $1 AND COALESCE(bell, false) = true`,
      [zoneId]
    )
    .catch(() => ({ rows: [] }));
  return r.rows.map((row) => row.user_id);
}

export async function listPersonBellFollowerIds(userId) {
  const r = await pool
    .query(
      `SELECT follower_id FROM follows
       WHERE following_id = $1 AND COALESCE(bell, false) = true`,
      [userId]
    )
    .catch(() => ({ rows: [] }));
  return r.rows.map((row) => row.follower_id);
}

/**
 * Push gate: directInterest OR bellOptIn
 * Surface (in-app) when deliverSurface; otherwise signal-only
 */
export function resolvePushEligibility({ directInterest = false, bellOptIn = false } = {}) {
  return Boolean(directInterest || bellOptIn);
}
