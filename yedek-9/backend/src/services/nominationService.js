/**
 * Venue nomination triage — LOCAL v2 §8
 * Sources: map long-press · free-ritual after · empty-search
 */
import pool from '../config/database.js';

function clusterKey(lat, lng) {
  if (lat == null || lng == null) return null;
  return `${Number(lat).toFixed(3)}_${Number(lng).toFixed(3)}`;
}

export async function nominateVenue({
  nominatorId,
  source,
  name,
  lat,
  lng,
  note,
}) {
  const allowed = new Set(['map_long_press', 'free_ritual', 'empty_search']);
  if (!allowed.has(source)) {
    return { ok: false, status: 400, error: 'invalid_source' };
  }
  const key = clusterKey(lat, lng);
  const r = await pool.query(
    `INSERT INTO venue_nominations (nominator_id, source, name, lat, lng, note, cluster_key, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'pooled')
     RETURNING *`,
    [nominatorId || null, source, name || null, lat ?? null, lng ?? null, note || null, key]
  );
  return { ok: true, nomination: r.rows[0] };
}

export async function listNominations({ status = 'pooled', limit = 50 } = {}) {
  const r = await pool.query(
    `SELECT * FROM venue_nominations
     WHERE ($1::text IS NULL OR status = $1)
     ORDER BY created_at DESC
     LIMIT $2`,
    [status, Math.min(Number(limit) || 50, 200)]
  );
  return { ok: true, nominations: r.rows };
}

export async function setNominationStatus(id, status) {
  const r = await pool.query(
    `UPDATE venue_nominations SET status = $2 WHERE id = $1 RETURNING *`,
    [id, status]
  );
  if (!r.rows[0]) return { ok: false, status: 404, error: 'not_found' };
  return { ok: true, nomination: r.rows[0] };
}
