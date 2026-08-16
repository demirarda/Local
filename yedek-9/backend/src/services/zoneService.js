/**
 * Zone service — LOCAL v2 §11 skeleton + profile
 */
import pool from '../config/database.js';
import LOCAL_CONFIG from '../config/localConfig.js';

export const isSparkEnabled = () => Boolean(LOCAL_CONFIG.zone.SPARK_ENABLED);

const MARKER_TYPES = new Set(['TREE', 'L', 'DJ', 'STONE', 'LINE']);

export async function listZones() {
  return (await pool.query(`SELECT * FROM zones ORDER BY created_at DESC`)).rows;
}

export async function getZone(id) {
  return (await pool.query(`SELECT * FROM zones WHERE id = $1`, [id])).rows[0] || null;
}

/** sonMD §4 TARİFELİ — hat bazlı zone-Aura kovası */
export async function getOrCreateLineZone(routeId) {
  const key = String(routeId || '').trim().slice(0, 120);
  if (!key) return null;
  const existing = await pool.query(`SELECT * FROM zones WHERE route_id = $1 LIMIT 1`, [key]);
  if (existing.rows[0]) return existing.rows[0];
  try {
    const ins = await pool.query(
      `INSERT INTO zones (name, marker_type, radius_m, route_id)
       VALUES ($1, 'LINE', $2, $3)
       RETURNING *`,
      [`Hat ${key}`, Number(LOCAL_CONFIG.zone?.DEFAULT_RADIUS_M) || 75, key]
    );
    return ins.rows[0];
  } catch (e) {
    if (e.code === '23505') {
      const again = await pool.query(`SELECT * FROM zones WHERE route_id = $1 LIMIT 1`, [key]);
      return again.rows[0] || null;
    }
    throw e;
  }
}

export async function createZone({
  name,
  geoLat = null,
  geoLng = null,
  markerType = 'TREE',
  radiusM = LOCAL_CONFIG.zone.DEFAULT_RADIUS_M,
  cityId = null,
}) {
  const mt = MARKER_TYPES.has(String(markerType || '').toUpperCase())
    ? String(markerType).toUpperCase()
    : 'TREE';
  const result = await pool.query(
    `INSERT INTO zones (name, geo_lat, geo_lng, marker_type, radius_m, city_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [name, geoLat, geoLng, mt, radiusM, cityId || null]
  );
  return result.rows[0];
}

export async function updateZone(id, { name, geoLat, geoLng, markerType, radiusM }) {
  const mt =
    markerType == null
      ? null
      : MARKER_TYPES.has(String(markerType).toUpperCase())
        ? String(markerType).toUpperCase()
        : null;
  const result = await pool.query(
    `UPDATE zones SET name = COALESCE($2,name), geo_lat = COALESCE($3,geo_lat), geo_lng = COALESCE($4,geo_lng),
     marker_type = COALESCE($5,marker_type), radius_m = COALESCE($6,radius_m) WHERE id = $1 RETURNING *`,
    [id, name ?? null, geoLat ?? null, geoLng ?? null, mt, radiusM ?? null]
  );
  return result.rows[0] || null;
}

export async function deleteZone(id) {
  return (await pool.query(`DELETE FROM zones WHERE id = $1 RETURNING id`, [id])).rows[0] || null;
}

/**
 * ZONE PROFİLİ: canlı Rituals + arşiv + Aura (Trust YOK) + forum + dağılım
 */
export async function getZoneProfile(zoneId) {
  const zone = await getZone(zoneId);
  if (!zone) return { ok: false, status: 404, error: 'Zone not found' };

  const [live, archive, forum, aura] = await Promise.all([
    pool.query(
      `SELECT r.id, r.title, r.status, r.start_time, r.capacity, r.event_group_id, r.spark_born,
              (SELECT COUNT(*)::int FROM ritual_attendance ra
               WHERE ra.ritual_id = r.id AND ra.status::text NOT IN ('no_show','cancelled')) AS joined
       FROM rituals r
       WHERE (r.zone_id = $1 OR r.route_id = (SELECT z.route_id FROM zones z WHERE z.id = $1 AND z.route_id IS NOT NULL))
         AND r.status::text IN ('prelobby','live','active','window','scheduled','published')
       ORDER BY r.start_time ASC
       LIMIT 40`,
      [zoneId]
    ).catch(() => ({ rows: [] })),
    pool.query(
      `SELECT r.id, r.title, r.start_time, r.status
       FROM rituals r
       WHERE (r.zone_id = $1 OR r.route_id = (SELECT z.route_id FROM zones z WHERE z.id = $1 AND z.route_id IS NOT NULL))
         AND r.status::text IN ('archived','ended','completed','window')
       ORDER BY r.start_time DESC
       LIMIT 20`,
      [zoneId]
    ).catch(() => ({ rows: [] })),
    pool.query(
      `SELECT COUNT(*)::int AS posts
       FROM forum_posts fp
       JOIN rituals r ON r.id = fp.ritual_id
       WHERE r.zone_id = $1 OR r.route_id = (SELECT z.route_id FROM zones z WHERE z.id = $1 AND z.route_id IS NOT NULL)`,
      [zoneId]
    ).catch(() => ({ rows: [{ posts: 0 }] })),
    computeZoneAura(zoneId),
  ]);

  const typeDist = await pool.query(
    `SELECT COALESCE(r.type, 'diger') AS category, COUNT(*)::int AS n
     FROM rituals r
     WHERE (r.zone_id = $1 OR r.route_id = (SELECT z.route_id FROM zones z WHERE z.id = $1 AND z.route_id IS NOT NULL))
       AND r.start_time >= NOW() - INTERVAL '90 days'
     GROUP BY COALESCE(r.type, 'diger')
     ORDER BY n DESC
     LIMIT 12`,
    [zoneId]
  ).catch(() => ({ rows: [] }));

  return {
    ok: true,
    profile: {
      ...zone,
      deep_link: `local://zone/${zone.id}`,
      live_rituals: live.rows,
      archive: archive.rows,
      /** Trust YOK — yalnızca Aura */
      aura: aura,
      trust: null,
      forum: { post_count: Number(forum.rows[0]?.posts || 0) },
      distribution: {
        hakimiyet: typeDist.rows,
        window_days: 90,
      },
    },
  };
}

async function computeZoneAura(zoneId) {
  const r = await pool.query(
    `SELECT
       COUNT(*)::int AS n,
       AVG(
         CASE LOWER(COALESCE(f.p2r_feeling, f.p2v_feeling, ''))
           WHEN 'green' THEN 1.0
           WHEN 'yellow' THEN 0.5
           WHEN 'red' THEN 0.15
           ELSE NULL
         END
       )::float AS aura_score
     FROM feedback f
     JOIN rituals r ON r.id = f.ritual_id
     WHERE (r.zone_id = $1 OR r.route_id = (SELECT z.route_id FROM zones z WHERE z.id = $1 AND z.route_id IS NOT NULL))
       AND f.feedback_type IN ('p2r','p2v','p2z','rq')
       AND COALESCE(f.submitted_at, f.created_at) >= NOW() - INTERVAL '90 days'`,
    [zoneId]
  ).catch(() => ({ rows: [{}] }));
  const n = Number(r.rows[0]?.n || 0);
  const score = r.rows[0]?.aura_score != null ? Number(r.rows[0].aura_score) : null;
  return {
    score: score != null ? Math.round(score * 100) / 100 : null,
    n_eff: n,
    window_days: 90,
    note: 'Zone Aura — Trust yok; tarifeli hat route_id ile bağlanır',
  };
}

/** ZONE-KEY: marker scan → zone profile + badge 1p signal */
export async function recordMarkerScan(zoneId, userId) {
  const zone = await getZone(zoneId);
  if (!zone) return { ok: false, status: 404, error: 'Zone not found' };
  const points = Number(LOCAL_CONFIG.zone?.MARKER_P) || 1;
  try {
    const { emitZoneBadgeSignal } = await import('./zoneBadgeSignalService.js');
    await emitZoneBadgeSignal(userId, 'marker_scan', points, { zone_id: zoneId });
  } catch (_e) {
    /* best effort */
  }
  return {
    ok: true,
    zone_id: zoneId,
    deep_link: `local://zone/${zoneId}`,
    points_awarded: points,
    profile_path: `/zones/${zoneId}`,
  };
}
