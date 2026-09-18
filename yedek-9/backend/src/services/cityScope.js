/**
 * sonMD §12.5 — active_city scope
 * Harita/keşif/city-akışı/slot = active_city filtreli
 * Arkadaş/takip Pulse + web-vitrin + forum-arşiv = city filtresi YOK
 */
import pool from '../config/database.js';

/**
 * @returns {Promise<string|null>} active_city_id UUID
 */
export async function resolveActiveCityId(userId, client = pool) {
  if (!userId) return null;
  const r = await client.query(
    `SELECT COALESCE(active_city_id, city_id) AS city_id
     FROM users WHERE id = $1`,
    [userId]
  );
  return r.rows[0]?.city_id || null;
}

/**
 * SQL fragment + params for ritual city scope.
 * Returns { sql, params } — sql empty if no city.
 */
export function ritualCityFilterSql(cityId, paramIndex, alias = 'r') {
  if (!cityId) return { sql: '', params: [] };
  return {
    sql: ` AND ${alias}.city_id = $${paramIndex}`,
    params: [cityId],
  };
}

export async function getCityById(cityId, client = pool) {
  if (!cityId) return null;
  const r = await client.query(
    `SELECT id, name, status, teaser_copy, notify_enabled, country, timezone,
            center_lat, center_lng, is_active, launch_date
     FROM cities WHERE id = $1`,
    [cityId]
  );
  return r.rows[0] || null;
}

/** İstanbul / Istanbul / IZMIR / İzmir → same key for legacy name filters */
export function foldCityName(name) {
  return String(name || '')
    .replace(/İ/g, 'i')
    .replace(/I/g, 'i')
    .replace(/ı/g, 'i')
    .trim()
    .toLowerCase();
}

/** SQL expression: fold Turkish I/İ/ı then lower — compare to foldCityName(param) */
export function foldCitySql(expr) {
  return `lower(replace(replace(replace(COALESCE(${expr}, ''), 'İ', 'i'), 'I', 'i'), 'ı', 'i'))`;
}

/**
 * Host city name OR ritual.city_id cities.name matches folded viewer city.
 */
export function cityNameScopeSql(foldedName, paramIndex) {
  if (!foldedName) return { sql: '', params: [] };
  return {
    sql: ` AND (
      ${foldCitySql('u.city')} = $${paramIndex}
      OR EXISTS (
        SELECT 1 FROM cities c_scope
        WHERE c_scope.id = r.city_id
          AND ${foldCitySql('c_scope.name')} = $${paramIndex}
      )
    )`,
    params: [foldedName],
  };
}

export function comingCityPayload(city) {
  if (!city) return null;
  const isComing = String(city.status || '').toUpperCase() === 'COMING';
  return {
    id: city.id,
    name: city.name,
    status: city.status,
    is_coming: isComing,
    teaser:
      city.teaser_copy ||
      (isComing
        ? 'LOCAL henüz şehrinde değil — açılınca haber verelim.'
        : null),
    notify_enabled: city.notify_enabled !== false,
  };
}
