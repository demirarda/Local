/**
 * Zone follow + bell — LOCAL v2 §13
 */
import pool from '../config/database.js';

export async function followZone(userId, zoneId, bell = false) {
  const zone = await pool.query(`SELECT id, name FROM zones WHERE id = $1`, [zoneId]);
  if (!zone.rows[0]) return { ok: false, status: 404, error: 'Zone not found' };
  await pool.query(
    `INSERT INTO zone_follows (user_id, zone_id, bell)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, zone_id) DO UPDATE SET bell = COALESCE(zone_follows.bell, EXCLUDED.bell)`,
    [userId, zoneId, bell === true]
  );
  const row = await pool.query(
    `SELECT * FROM zone_follows WHERE user_id = $1 AND zone_id = $2`,
    [userId, zoneId]
  );
  return { ok: true, follow: row.rows[0], zone: zone.rows[0] };
}

export async function unfollowZone(userId, zoneId) {
  const r = await pool.query(
    `DELETE FROM zone_follows WHERE user_id = $1 AND zone_id = $2 RETURNING id`,
    [userId, zoneId]
  );
  if (!r.rows[0]) return { ok: false, status: 404, error: 'Follow not found' };
  return { ok: true };
}

export async function setZoneFollowBell(userId, zoneId, bell) {
  const r = await pool.query(
    `UPDATE zone_follows SET bell = $3
     WHERE user_id = $1 AND zone_id = $2
     RETURNING *`,
    [userId, zoneId, bell === true]
  );
  if (!r.rows[0]) return { ok: false, status: 404, error: 'Follow not found — önce takip et' };
  return { ok: true, follow: r.rows[0] };
}

export async function getZoneFollowStatus(userId, zoneId) {
  const r = await pool.query(
    `SELECT * FROM zone_follows WHERE user_id = $1 AND zone_id = $2 LIMIT 1`,
    [userId, zoneId]
  );
  return {
    ok: true,
    is_following: r.rows.length > 0,
    bell: r.rows[0] ? Boolean(r.rows[0].bell) : false,
  };
}
