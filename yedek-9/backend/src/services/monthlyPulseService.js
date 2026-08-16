/**
 * Aylık Nabız + Pazar Payı — LOCAL v2 §8
 */
import pool from '../config/database.js';
import {
  hasPackageFeature,
  resolveTierFromVenue,
  loadVenuePackageRow,
} from './venuePackageService.js';

export async function buildMonthlyPulse(venueId, { month } = {}) {
  const venue = await loadVenuePackageRow(venueId);
  if (!venue) return { ok: false, status: 404, error: 'Venue not found' };
  const tier = resolveTierFromVenue(venue);
  if (!hasPackageFeature(venue, 'aylik_nabiz') && tier === 'free') {
    return { ok: false, status: 403, error: 'Aylık Nabız OPERATÖR+ gerektirir' };
  }

  const ref = month ? new Date(`${month}-01T00:00:00Z`) : new Date();
  const y = ref.getUTCFullYear();
  const m = ref.getUTCMonth();
  const start = new Date(Date.UTC(y, m, 1));
  const end = new Date(Date.UTC(y, m + 1, 1));

  const heat = await pool.query(
    `SELECT EXTRACT(DOW FROM r.start_time)::int AS dow,
            EXTRACT(HOUR FROM r.start_time)::int AS hour,
            COUNT(*)::int AS n,
            AVG(
              (SELECT COUNT(*)::float FROM ritual_attendance ra
               WHERE ra.ritual_id = r.id AND ra.checkin_at IS NOT NULL)
              / NULLIF(r.capacity, 0)
            ) AS avg_occ
     FROM rituals r
     WHERE r.venue_id = $1
       AND r.start_time >= $2 AND r.start_time < $3
       AND r.status::text NOT IN ('cancelled', 'draft')
     GROUP BY 1, 2
     ORDER BY 1, 2`,
    [venueId, start.toISOString(), end.toISOString()]
  );

  const daily = await pool.query(
    `SELECT DATE(r.start_time) AS d,
            COUNT(*)::int AS rituals,
            COUNT(DISTINCT ra.user_id) FILTER (WHERE ra.checkin_at IS NOT NULL)::int AS checkins
     FROM rituals r
     LEFT JOIN ritual_attendance ra ON ra.ritual_id = r.id
     WHERE r.venue_id = $1
       AND r.start_time >= $2 AND r.start_time < $3
     GROUP BY 1
     ORDER BY 1`,
    [venueId, start.toISOString(), end.toISOString()]
  );

  const occ = daily.rows.map((r) => Number(r.checkins) || 0);
  const avg = occ.length ? occ.reduce((a, b) => a + b, 0) / occ.length : 0;
  const deadDays = daily.rows.filter((r) => (Number(r.checkins) || 0) < avg * 0.4);
  const peakDays = daily.rows.filter((r) => (Number(r.checkins) || 0) > avg * 1.2);
  const deadDelta =
    avg > 0 && peakDays.length
      ? Math.round(
          ((peakDays.reduce((s, d) => s + Number(d.checkins), 0) / peakDays.length - avg) / avg) * 100
        )
      : 0;

  const regularGrowth = await pool.query(
    `SELECT COUNT(*) FILTER (WHERE regular_since >= $2 AND regular_since < $3)::int AS new_regulars,
            COUNT(*) FILTER (WHERE is_regular)::int AS total_regulars
     FROM venue_regulars WHERE venue_id = $1`,
    [venueId, start.toISOString(), end.toISOString()]
  ).catch(() => ({ rows: [{ new_regulars: 0, total_regulars: 0 }] }));

  const audience = await pool.query(
    `SELECT vs.audience_tag, COUNT(*)::int AS n
     FROM venue_slots vs
     WHERE vs.venue_id = $1 AND vs.audience_tag IS NOT NULL
       AND vs.created_at >= $2 AND vs.created_at < $3
     GROUP BY 1`,
    [venueId, start.toISOString(), end.toISOString()]
  ).catch(() => ({ rows: [] }));

  const audTotal = audience.rows.reduce((s, a) => s + Number(a.n), 0) || 0;

  return {
    ok: true,
    venue_id: venueId,
    month: `${y}-${String(m + 1).padStart(2, '0')}`,
    heatmap: heat.rows,
    dead_day_delta_pct: deadDelta,
    dead_days: deadDays.length,
    regular_growth: regularGrowth.rows[0],
    distribution: daily.rows,
    audience_aggregate: {
      uni_pct: audTotal
        ? Math.round(
            ((Number(audience.rows.find((a) => a.audience_tag === 'UNI_FRIENDLY')?.n) || 0) / audTotal) *
              100
          )
        : 0,
      intl_pct: audTotal
        ? Math.round(
            ((Number(audience.rows.find((a) => a.audience_tag === 'INTERNATIONAL')?.n) || 0) /
              audTotal) *
              100
          )
        : 0,
    },
  };
}

/** Pazar Payı (HAKİM) + kilitli teaser (OPERATÖR) */
export async function buildMarketShare(venueId, { month } = {}) {
  const venue = await loadVenuePackageRow(venueId);
  if (!venue) return { ok: false, status: 404, error: 'Venue not found' };
  const tier = resolveTierFromVenue(venue);
  const locked = tier === 'operator';
  const allowed = tier === 'hakim' || locked;
  if (!allowed) {
    return { ok: false, status: 403, error: 'Pazar Payı OPERATÖR+ (kilitli teaser) / HAKİM' };
  }

  const cityR = await pool.query(`SELECT city, location_lat, location_lng FROM venues WHERE id = $1`, [
    venueId,
  ]);
  const city = cityR.rows[0]?.city || '';

  const ref = month ? new Date(`${month}-01T00:00:00Z`) : new Date();
  const y = ref.getUTCFullYear();
  const m = ref.getUTCMonth();
  const start = new Date(Date.UTC(y, m, 1));
  const end = new Date(Date.UTC(y, m + 1, 1));

  const region = await pool.query(
    `SELECT COUNT(*)::int AS n FROM rituals r
     LEFT JOIN venues v ON v.id = r.venue_id
     LEFT JOIN users hu ON hu.id = r.host_id
     WHERE r.start_time >= $1 AND r.start_time < $2
       AND r.status::text NOT IN ('cancelled', 'draft')
       AND (
         LOWER(COALESCE(v.city, hu.city, '')) = LOWER($3)
         OR LOWER(COALESCE(r.location_name, '')) LIKE '%' || LOWER($3) || '%'
       )`,
    [start.toISOString(), end.toISOString(), city]
  );

  const mine = await pool.query(
    `SELECT COUNT(*)::int AS n FROM rituals
     WHERE venue_id = $1 AND start_time >= $2 AND start_time < $3
       AND status::text NOT IN ('cancelled', 'draft')`,
    [venueId, start.toISOString(), end.toISOString()]
  );

  const regionN = Number(region.rows[0]?.n || 0);
  const mineN = Number(mine.rows[0]?.n || 0);
  const pct = regionN > 0 ? Math.round((mineN / regionN) * 1000) / 10 : 0;

  const copy = `Bölgede bu ay ${regionN} Ritual — ${mineN}'i sende (%${pct})`;

  if (locked) {
    return {
      ok: true,
      locked: true,
      teaser: true,
      venue_id: venueId,
      month: `${y}-${String(m + 1).padStart(2, '0')}`,
      blur_copy: 'Bölgede bu ay ··· Ritual — ···\'i sende (%··)',
      upgrade_hint: 'HAKİM paketi ile Pazar Payı + Bölge Radarı + Anonim Benchmark',
    };
  }

  const radar = await pool.query(
    `SELECT DATE_TRUNC('week', r.start_time) AS week, COUNT(*)::int AS n
     FROM rituals r
     LEFT JOIN venues v ON v.id = r.venue_id
     WHERE r.start_time >= $1 AND r.start_time < $2
       AND LOWER(COALESCE(v.city, '')) = LOWER($3)
     GROUP BY 1 ORDER BY 1`,
    [start.toISOString(), end.toISOString(), city]
  );

  return {
    ok: true,
    locked: false,
    venue_id: venueId,
    month: `${y}-${String(m + 1).padStart(2, '0')}`,
    region_rituals: regionN,
    venue_rituals: mineN,
    share_pct: pct,
    copy,
    bolge_radari: radar.rows,
    anonim_benchmark: {
      note: 'Kimliksiz bölge aggregate',
      region_avg_per_venue: regionN > 0 ? Math.round((regionN / Math.max(1, mineN || 1)) * 10) / 10 : 0,
    },
  };
}
