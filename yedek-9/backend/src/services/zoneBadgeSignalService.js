/**
 * Zone badge points → badge engine signal — LOCAL v2 §11
 * ritual 3p / marker scan 1p (config)
 */
import pool from '../config/database.js';
import LOCAL_CONFIG from '../config/localConfig.js';

export async function emitZoneBadgeSignal(userId, kind, points, meta = {}) {
  if (!userId || !points) return { ok: true, skipped: true };
  await pool.query(
    `INSERT INTO zone_badge_points (user_id, kind, points, meta)
     VALUES ($1, $2, $3, $4::jsonb)`,
    [userId, String(kind || 'unknown').slice(0, 40), Number(points) || 0, JSON.stringify(meta || {})]
  ).catch(async () => {
    // fallback if table missing — score_events
    await pool.query(
      `INSERT INTO score_events (user_id, event_type, delta, meta, created_at)
       VALUES ($1, $2, $3, $4::jsonb, NOW())`,
      [
        userId,
        `zone_badge_${kind}`,
        Number(points) || 0,
        JSON.stringify(meta || {}),
      ]
    ).catch(() => {});
  });
  return { ok: true, user_id: userId, kind, points };
}

/** After ritual in a zone completes for a participant */
export async function awardZoneRitualPoints(userId, ritualId) {
  const points = Number(LOCAL_CONFIG.zone?.BADGE_RITUAL_P) || 3;
  const r = await pool.query(`SELECT zone_id FROM rituals WHERE id = $1`, [ritualId]);
  const zoneId = r.rows[0]?.zone_id;
  if (!zoneId) return { ok: true, skipped: true, reason: 'no_zone' };
  return emitZoneBadgeSignal(userId, 'ritual', points, { ritual_id: ritualId, zone_id: zoneId });
}
