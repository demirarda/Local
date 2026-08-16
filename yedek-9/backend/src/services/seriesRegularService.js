/**
 * Series-Regular F1.5 — sonMD Defter-Kapanış
 * Son 8 instance'ta ≥5 mühür → silent badge + host roster.
 * Skor / keşif boost YOK. SERIES_REGULAR_ONLY audience gate.
 */
import pool from '../config/database.js';
import LOCAL_CONFIG from '../config/localConfig.js';

const WINDOW = 8;
const MIN_SEALS = 5;

export function isSeriesRegularEnabled() {
  return LOCAL_CONFIG.stubs?.SERIES_REGULAR_ENABLED === true;
}

/**
 * Evaluate and upsert series_regular for a user after a seal/check-in.
 * Zero score/discovery effect.
 */
export async function evaluateSeriesRegular({ seriesId, userId } = {}) {
  if (!isSeriesRegularEnabled()) {
    return { ok: true, skipped: true, reason: 'SERIES_REGULAR_OFF' };
  }
  if (!seriesId || !userId) return { ok: false, error: 'series_id and user_id required' };

  const instances = await pool.query(
    `SELECT r.id
     FROM rituals r
     WHERE r.series_id = $1
       AND COALESCE(r.status::text, '') NOT IN ('cancelled', 'draft', 'created')
     ORDER BY r.start_time DESC NULLS LAST
     LIMIT $2`,
    [seriesId, WINDOW]
  );
  if (!instances.rows.length) {
    return { ok: true, sealed_count: 0, is_regular: false };
  }

  const ids = instances.rows.map((r) => r.id);
  const seals = await pool.query(
    `SELECT COUNT(DISTINCT ritual_id)::int AS n
     FROM ritual_attendance
     WHERE user_id = $1
       AND ritual_id = ANY($2::uuid[])
       AND (
         checkin_status IN ('sealed', 'MUHURLU', 'checked_in')
         OR checked_in_at IS NOT NULL
         OR (status = 'confirmed' AND keyword_verified_at IS NOT NULL)
       )`,
    [userId, ids]
  ).catch(async () => {
    // Fallback if some columns missing
    return pool.query(
      `SELECT COUNT(DISTINCT ritual_id)::int AS n
       FROM ritual_attendance
       WHERE user_id = $1
         AND ritual_id = ANY($2::uuid[])
         AND status NOT IN ('cancelled', 'no_show', 'left')
         AND checked_in_at IS NOT NULL`,
      [userId, ids]
    );
  });

  const sealedCount = Number(seals.rows[0]?.n) || 0;
  const isRegular = sealedCount >= MIN_SEALS;

  if (isRegular) {
    await pool.query(
      `INSERT INTO series_regulars (series_id, user_id, sealed_count, window_instances, earned_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT (series_id, user_id) DO UPDATE
         SET sealed_count = EXCLUDED.sealed_count,
             updated_at = NOW()`,
      [seriesId, userId, sealedCount, WINDOW]
    );
  } else {
    await pool.query(
      `DELETE FROM series_regulars WHERE series_id = $1 AND user_id = $2`,
      [seriesId, userId]
    );
  }

  return {
    ok: true,
    sealed_count: sealedCount,
    is_regular: isRegular,
    threshold: MIN_SEALS,
    window: WINDOW,
    score_boost: 0,
    discovery_boost: 0,
  };
}

export async function isSeriesRegular(userId, seriesId) {
  if (!isSeriesRegularEnabled() || !userId || !seriesId) return false;
  const r = await pool.query(
    `SELECT 1 FROM series_regulars WHERE series_id = $1 AND user_id = $2 LIMIT 1`,
    [seriesId, userId]
  );
  return r.rows.length > 0;
}

export async function listSeriesRegulars(seriesId) {
  if (!seriesId) return [];
  const r = await pool.query(
    `SELECT sr.user_id, sr.sealed_count, sr.earned_at, u.name, u.avatar_url
     FROM series_regulars sr
     JOIN users u ON u.id = sr.user_id
     WHERE sr.series_id = $1
     ORDER BY sr.earned_at ASC`,
    [seriesId]
  );
  return r.rows;
}

/** Join gate for SERIES_REGULAR_ONLY visibility */
export async function assertSeriesRegularOnlyJoin({ userId, ritual, hostId } = {}) {
  const vis = String(ritual?.visibility || '').toLowerCase();
  if (vis !== 'series_regular_only') return { ok: true };
  if (!isSeriesRegularEnabled()) {
    if (String(hostId || ritual?.host_id) === String(userId)) return { ok: true };
    return { ok: false, code: 'SERIES_REGULAR_OFF', error: 'Series-Regular launch’ta yok' };
  }
  if (String(hostId || ritual?.host_id) === String(userId)) return { ok: true };
  const seriesId = ritual?.series_id;
  if (!seriesId) {
    return { ok: false, code: 'SERIES_REGULAR_ONLY', error: 'Bu masa Series-Regular üyelerine açık' };
  }
  const ok = await isSeriesRegular(userId, seriesId);
  if (!ok) {
    return {
      ok: false,
      code: 'SERIES_REGULAR_ONLY',
      error: 'Bu masa yalnız Series-Regular üyelerine açık',
    };
  }
  return { ok: true };
}

export const SERIES_REGULAR_SPEC = {
  window: WINDOW,
  min_seals: MIN_SEALS,
  score_boost: 0,
  discovery_boost: 0,
};
