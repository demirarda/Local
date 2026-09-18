/**
 * §13 Yüz-2 hakim agregatları — kişisel DS yok, MIN-N altı render yok.
 * ① venue kitle-karışımı ② zone keşif-endeksi ③ marka kitle-uyum
 */
import pool from '../config/database.js';
import LOCAL_CONFIG, { binDsValues, crowdFitScore } from '../config/localConfig.js';
import { getCityDsCurveByCityId } from './dsEngine.js';
import { loadVenuePackageRow, resolveTierFromVenue } from './venuePackageService.js';

const WINDOW_DAYS = Number(LOCAL_CONFIG.venue?.WINDOW_DAYS) || 120;
const MIN_N = Number(LOCAL_CONFIG.ds.AGGREGATE_MIN_N) || 20;

const SEALED_SQL = `ra.checkin_at IS NOT NULL
  AND COALESCE(ra.checkin_phase, 'sealed') = 'sealed'
  AND ra.status::text NOT IN ('no_show', 'cancelled')`;

function hidePayload(extra = {}) {
  return {
    hidden: true,
    reason: extra.reason || 'min_n',
    n: extra.n || 0,
    min_n: MIN_N,
    window_days: WINDOW_DAYS,
    note: 'Anonim agregat · kişisel DS yok',
    ...extra,
  };
}

function binsPayload(dist) {
  if (!dist || dist.hidden) {
    return hidePayload({ n: dist?.n || 0, reason: dist?.reason || 'min_n' });
  }
  return {
    hidden: false,
    n: dist.n,
    min_n: dist.min_n,
    mean: dist.mean,
    bins: dist.bins,
    window_days: WINDOW_DAYS,
    note: 'Anonim mühürlü kitle · kişisel DS yok',
  };
}

async function binsForSealedUsers(whereSql, params) {
  const r = await pool.query(
    `SELECT uds.ds_full_ema
     FROM user_diversity_state uds
     WHERE uds.ds_full_ema IS NOT NULL
       AND uds.user_id IN (
         SELECT DISTINCT ra.user_id
         FROM ritual_attendance ra
         JOIN rituals r ON r.id = ra.ritual_id
         LEFT JOIN venues v ON v.id = r.venue_id
         WHERE ${SEALED_SQL}
           AND r.start_time >= NOW() - ($1::int * INTERVAL '1 day')
           AND (${whereSql})
       )`,
    [WINDOW_DAYS, ...params]
  );
  return binDsValues(
    r.rows.map((row) => row.ds_full_ema),
    MIN_N
  );
}

/** ① Venue kitle-karışımı — HAKİM tam / OPERATÖR teaser / FREE kapalı */
export async function getVenueCrowdMix(venueId) {
  const venue = await loadVenuePackageRow(venueId);
  if (!venue) return { ok: false, status: 404, error: 'Venue not found' };
  const tier = resolveTierFromVenue(venue);
  if (tier === 'free') {
    return {
      ok: false,
      status: 403,
      error: 'Kitle karışımı OPERATÖR+ (kilitli teaser) / HAKİM',
    };
  }
  if (tier === 'operator') {
    return {
      ok: true,
      locked: true,
      teaser: true,
      venue_id: venueId,
      blur_copy: 'Kitle karışımı ···',
      upgrade_hint: 'HAKİM paketi ile anonim keşif karışımı (MIN-N, kişisel DS yok)',
    };
  }
  const dist = await binsForSealedUsers('r.venue_id = $2', [venueId]);
  return { ok: true, locked: false, venue_id: venueId, ...binsPayload(dist) };
}

/** ② Semt/zone keşif-endeksi — anonim MIN-N, kullanıcı id yok */
export async function getZoneDiscoveryIndex(zoneId) {
  if (!zoneId) return hidePayload({ reason: 'no_zone' });
  const dist = await binsForSealedUsers(
    `r.zone_id = $2
     OR r.route_id = (SELECT z.route_id FROM zones z WHERE z.id = $2 AND z.route_id IS NOT NULL)`,
    [zoneId]
  );
  const payload = binsPayload(dist);
  return {
    ...payload,
    zone_id: zoneId,
    index: payload.hidden ? null : payload.mean,
  };
}

async function brandPrimaryCityId(brandId) {
  const r = await pool.query(
    `SELECT usr.active_city_id AS city_id, COUNT(*)::int AS n
     FROM ritual_attendance ra
     JOIN rituals r ON r.id = ra.ritual_id
     LEFT JOIN venues v ON v.id = r.venue_id
     JOIN users usr ON usr.id = ra.user_id
     WHERE ${SEALED_SQL}
       AND r.start_time >= NOW() - ($1::int * INTERVAL '1 day')
       AND (r.brand_id = $2 OR v.brand_id = $2)
       AND usr.active_city_id IS NOT NULL
     GROUP BY usr.active_city_id
     ORDER BY n DESC
     LIMIT 1`,
    [WINDOW_DAYS, brandId]
  );
  return r.rows[0]?.city_id || null;
}

/** ③ Marka kitle-uyum (F2) — yalnız brand member; üye DS satırı yok */
export async function getBrandCrowdFit(brandId) {
  if (!brandId) return { ok: false, status: 400, error: 'brand_id required' };
  const dist = await binsForSealedUsers(
    'r.brand_id = $2 OR v.brand_id = $2',
    [brandId]
  );
  const payload = binsPayload(dist);
  if (payload.hidden) {
    return { ok: true, brand_id: brandId, fit: null, ...payload };
  }
  const cityId = await brandPrimaryCityId(brandId);
  const city = cityId ? await getCityDsCurveByCityId(cityId) : null;
  const fit =
    city && !city.hidden ? crowdFitScore(payload.bins, city.bins) : null;
  return {
    ok: true,
    brand_id: brandId,
    fit,
    city_curve_hidden: !city || city.hidden,
    ...payload,
  };
}
