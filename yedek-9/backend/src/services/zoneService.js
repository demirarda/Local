/**
 * Zone service — LOCAL v2 §11 skeleton + profile
 */
import pool from '../config/database.js';
import LOCAL_CONFIG from '../config/localConfig.js';
import { computeZoneAuraDisplay } from './venueTrustAuraService.js';
import {
  zoneHasTrustNumber,
  buildCharacterDistribution,
  buildLiveness,
  zoneLeagueSpec,
  zoneCandidateStory,
  takeRateForZone,
  sanitizeZonePublic,
  isAuraIdentityChip,
} from './megaZone.js';
import { assertP2cZoneCandidate } from './megaLaunchLocks.js';

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

  const windowD = Number(LOCAL_CONFIG.zone?.CHARACTER_WINDOW_D ?? 90);
  const [live, archive, forum, aura, dsDiscovery, past, weekly, typeDist, uniDist, auraWords] = await Promise.all([
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
    import('./dsAggregateService.js')
      .then((m) => m.getZoneDiscoveryIndex(zoneId))
      .catch(() => ({ hidden: true, reason: 'unavailable', n: 0 })),
    pool.query(
      `SELECT COUNT(*)::int AS n FROM rituals r
       WHERE r.zone_id = $1 AND r.start_time < NOW()
         AND r.status::text NOT IN ('cancelled','draft')`,
      [zoneId]
    ).catch(() => ({ rows: [{ n: 0 }] })),
    pool.query(
      `SELECT COUNT(*)::int AS n FROM rituals r
       WHERE r.zone_id = $1
         AND r.start_time >= date_trunc('week', NOW())
         AND r.status::text NOT IN ('cancelled','draft')`,
      [zoneId]
    ).catch(() => ({ rows: [{ n: 0 }] })),
    pool.query(
      `SELECT COALESCE(r.type, 'diger') AS category, COUNT(*)::int AS n
       FROM rituals r
       WHERE r.zone_id = $1 AND r.start_time >= NOW() - ($2 || ' days')::interval
       GROUP BY COALESCE(r.type, 'diger')
       ORDER BY n DESC
       LIMIT 12`,
      [zoneId, String(windowD)]
    ).catch(() => ({ rows: [] })),
    pool.query(
      `SELECT COALESCE(u.university, u.uni, 'diger') AS uni, COUNT(DISTINCT ra.user_id)::int AS n
       FROM ritual_attendance ra
       JOIN rituals r ON r.id = ra.ritual_id
       JOIN users u ON u.id = ra.user_id
       WHERE r.zone_id = $1 AND ra.checkin_phase = 'sealed'
       GROUP BY 1
       ORDER BY n DESC
       LIMIT 6`,
      [zoneId]
    ).catch(() => ({ rows: [] })),
    pool.query(
      `SELECT f.chip_id, COUNT(*)::int AS n
       FROM feedback f
       JOIN rituals r ON r.id = f.ritual_id
       WHERE r.zone_id = $1 AND f.feedback_type = 'p2z' AND f.chip_id IS NOT NULL
       GROUP BY f.chip_id
       ORDER BY n DESC
       LIMIT 8`,
      [zoneId]
    ).catch(() => ({ rows: [] })),
  ]);

  const character = buildCharacterDistribution(typeDist.rows);
  const liveness = buildLiveness({
    pastTables: Number(past.rows[0]?.n || 0),
    weeklyTables: Number(weekly.rows[0]?.n || 0),
    liveNow: live.rows.length,
  });
  const { auraWordForChip } = await import('../i18n/auraCopyMap.js');
  const sikAnilanlar = auraWords.rows
    .filter((row) => isAuraIdentityChip(row.chip_id))
    .map((row) => auraWordForChip(row.chip_id))
    .filter(Boolean);

  let nearbyVenues = [];
  if (zone.geo_lat != null && zone.geo_lng != null) {
    nearbyVenues = (
      await pool.query(
        `SELECT id, name,
                (6371000 * acos(LEAST(1, GREATEST(-1,
                  cos(radians($1)) * cos(radians(location_lat)) *
                  cos(radians(location_lng) - radians($2)) +
                  sin(radians($1)) * sin(radians(location_lat))
                )))) AS distance_m
         FROM venues
         WHERE location_lat IS NOT NULL AND location_lng IS NOT NULL
         ORDER BY distance_m ASC NULLS LAST
         LIMIT 5`,
        [Number(zone.geo_lat), Number(zone.geo_lng)]
      ).catch(() => ({ rows: [] }))
    ).rows.filter((v) => Number(v.distance_m) <= 500);
  }

  const publicZone = sanitizeZonePublic(zone);
  return {
    ok: true,
    profile: {
      ...publicZone,
      is_venue: false,
      has_door: false,
      has_cashier: false,
      deep_link: `local://zone/${zone.id}`,
      live_rituals: live.rows,
      archive: archive.rows,
      aura: {
        ...aura,
        score: zoneHasTrustNumber() ? aura.score : null,
        trust: null,
        words: sikAnilanlar.slice(0, 5),
        words_copy: sikAnilanlar.slice(0, 3).join(' · ') || null,
      },
      trust: zoneHasTrustNumber() ? aura : null,
      forum: { post_count: Number(forum.rows[0]?.posts || 0) },
      liveness,
      character,
      distribution: {
        hakimiyet: character.parts,
        ruhu: character.ruhu,
        uni: uniDist.rows,
        window_days: character.window_days,
      },
      sik_anilanlar: sikAnilanlar,
      take_rate: takeRateForZone(),
      nearby_venues: nearbyVenues,
      ds_discovery: dsDiscovery,
    },
  };
}

async function computeZoneAura(zoneId) {
  try {
    return await computeZoneAuraDisplay(zoneId, { audience: 'public' });
  } catch (_e) {
    return {
      score: null,
      n_eff: 0,
      window_days: Number(LOCAL_CONFIG.venue?.WINDOW_DAYS) || 120,
      source: 'p2z',
      trust: null,
      note: 'Zone Aura — Trust yok; yalnız P2Z; VEN-4',
    };
  }
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

export async function buildZoneLeague({ weekStart = null } = {}) {
  const spec = zoneLeagueSpec();
  const start = weekStart ? new Date(weekStart) : null;
  const weekExpr = start
    ? `$1::timestamptz`
    : `date_trunc('week', NOW())`;
  const params = start ? [start.toISOString()] : [];
  const r = await pool.query(
    `SELECT z.id, z.name,
            COUNT(r.id)::int AS tables
     FROM zones z
     LEFT JOIN rituals r ON r.zone_id = z.id
       AND r.start_time >= ${weekExpr}
       AND r.status::text NOT IN ('cancelled','draft')
     GROUP BY z.id, z.name
     ORDER BY tables DESC, z.name ASC
     LIMIT 40`,
    params
  ).catch(() => ({ rows: [] }));
  return {
    ok: true,
    ...spec,
    week_start: start ? start.toISOString() : null,
    standings: r.rows.map((row, i) => ({
      rank: i + 1,
      zone_id: row.id,
      name: row.name,
      tables: Number(row.tables) || 0,
      score: null,
      person: null,
    })),
  };
}

export async function declareZoneFromCandidate({
  name,
  geoLat,
  geoLng,
  people = 0,
  rituals = 0,
  isHome = false,
  cityId = null,
  radiusM,
} = {}) {
  const gate = assertP2cZoneCandidate({ isHome, people, rituals });
  if (!gate.ok) return { ...gate, status: 403 };
  const zone = await createZone({
    name: String(name || '').trim() || 'Yeni zone',
    geoLat,
    geoLng,
    markerType: 'TREE',
    radiusM: radiusM || LOCAL_CONFIG.zone.DEFAULT_RADIUS_M,
    cityId,
  });
  return {
    ok: true,
    zone,
    story: zoneCandidateStory(),
    birth: 'city',
  };
}

export async function enqueueZoneOps({ zoneId, ritualId, chipId, userId, kind = null, note = null } = {}) {
  try {
    const r = await pool.query(
      `INSERT INTO zone_ops_queue (zone_id, ritual_id, chip_id, kind, created_by, note)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [zoneId || null, ritualId || null, chipId || null, kind || chipId, userId || null, note]
    );
    return { ok: true, row: r.rows[0] };
  } catch (_e) {
    return { ok: false, soft: true };
  }
}
