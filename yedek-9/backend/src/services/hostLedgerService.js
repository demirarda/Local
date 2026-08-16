/**
 * Host private ledger — doluluk / zamanında / no-show / hosted rituals.
 * sonMD: Host sekmesi yok ama private host geçmişi (HostHistory) gerçek veri.
 */
import pool from '../db.js';

export async function getHostLedger(userId) {
  const hosted = await pool.query(
    `SELECT COUNT(*)::int AS n
     FROM rituals
     WHERE host_id = $1
       AND status::text NOT IN ('draft', 'cancelled')`,
    [userId]
  );

  const attendance = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE ra.status = 'checked_in' OR ra.checked_in_at IS NOT NULL)::int AS checked,
       COUNT(*) FILTER (WHERE ra.status = 'no_show')::int AS noshow,
       COUNT(*)::int AS total
     FROM ritual_attendance ra
     JOIN rituals r ON r.id = ra.ritual_id
     WHERE r.host_id = $1
       AND r.status::text IN ('archived', 'live', 'window', 'completed')`,
    [userId]
  );

  const fill = await pool.query(
    `SELECT COALESCE(AVG(
        CASE WHEN r.capacity > 0
          THEN LEAST(1.0, (
            SELECT COUNT(*)::float FROM ritual_attendance ra2
            WHERE ra2.ritual_id = r.id AND ra2.status NOT IN ('left', 'cancelled', 'no_show')
          ) / r.capacity)
          ELSE NULL END
      ), 0) AS avg_fill
     FROM rituals r
     WHERE r.host_id = $1
       AND r.status::text NOT IN ('draft', 'cancelled')`,
    [userId]
  );

  const rituals = await pool.query(
    `SELECT r.id, r.title, r.start_time, r.status::text AS status,
            r.capacity,
            (SELECT COUNT(*)::int FROM ritual_attendance ra
              WHERE ra.ritual_id = r.id
                AND ra.status NOT IN ('left', 'cancelled', 'no_show')) AS attendees,
            (SELECT COUNT(*)::int FROM ritual_attendance ra
              WHERE ra.ritual_id = r.id AND ra.status = 'no_show') AS noshows,
            r.series_id
     FROM rituals r
     WHERE r.host_id = $1
       AND r.status::text NOT IN ('draft')
     ORDER BY r.start_time DESC NULLS LAST
     LIMIT 24`,
    [userId]
  );

  const a = attendance.rows[0] || {};
  const total = Number(a.total) || 0;
  const checked = Number(a.checked) || 0;
  const noshow = Number(a.noshow) || 0;
  const onTimePct = total > 0 ? Math.round((checked / total) * 100) : 0;
  const noShowPct = total > 0 ? Math.round((noshow / total) * 100) : 0;
  const avgFillPct = Math.round(Number(fill.rows[0]?.avg_fill || 0) * 100);

  return {
    ok: true,
    hosted: Number(hosted.rows[0]?.n) || 0,
    on_time_pct: onTimePct,
    no_show_pct: noShowPct,
    avg_fill_pct: avgFillPct,
    rituals: rituals.rows.map((r) => ({
      id: r.id,
      title: r.title,
      start_time: r.start_time,
      status: r.status,
      attendees: r.attendees,
      capacity: r.capacity,
      noshows: r.noshows,
      series_id: r.series_id,
      fill_pct:
        r.capacity > 0 ? Math.round((Number(r.attendees) / Number(r.capacity)) * 100) : null,
    })),
  };
}

/**
 * Hakim / şehir ortağı — district breakdown + market share for a venue.
 */
export async function getVenueMarketShare(venueId, { windowDays = 30 } = {}) {
  const venue = await pool.query(
    `SELECT v.id, v.name, v.city, v.package_tier, v.city_id
     FROM venues v WHERE v.id = $1`,
    [venueId]
  );
  if (!venue.rows[0]) return { ok: false, status: 404, error: 'Venue not found' };
  const v = venue.rows[0];
  const cityParam = v.city || '%';

  const venueCount = await pool.query(
    `SELECT COUNT(*)::int AS n FROM rituals r
     WHERE r.venue_id = $1
       AND r.start_time >= NOW() - ($2::text || ' days')::interval
       AND r.status::text NOT IN ('draft', 'cancelled')`,
    [venueId, String(windowDays)]
  );

  let cityCount = { rows: [{ n: 0 }] };
  try {
    cityCount = await pool.query(
      `SELECT COUNT(*)::int AS n FROM rituals r
       WHERE r.start_time >= NOW() - ($1::text || ' days')::interval
         AND r.status::text NOT IN ('draft', 'cancelled')
         ${v.city_id ? 'AND r.city_id = $2' : 'AND (r.city ILIKE $2 OR r.city IS NULL)'}`,
      v.city_id ? [String(windowDays), v.city_id] : [String(windowDays), cityParam]
    );
  } catch {
    cityCount = { rows: [{ n: Number(venueCount.rows[0]?.n) || 0 }] };
  }

  const districts = await pool.query(
    `SELECT COALESCE(r.neighborhood, r.district, r.zone_name, 'Diger') AS district,
            COUNT(*)::int AS rituals_count,
            COALESCE(SUM(
              (SELECT COUNT(*)::int FROM ritual_attendance ra
               WHERE ra.ritual_id = r.id
                 AND ra.status NOT IN ('left', 'cancelled', 'no_show'))
            ), 0)::int AS attendees
     FROM rituals r
     WHERE r.venue_id = $1
       AND r.start_time >= NOW() - ($2::text || ' days')::interval
       AND r.status::text NOT IN ('draft', 'cancelled')
     GROUP BY 1
     ORDER BY rituals_count DESC
     LIMIT 12`,
    [venueId, String(windowDays)]
  );

  const vc = Number(venueCount.rows[0]?.n) || 0;
  const cc = Number(cityCount.rows[0]?.n) || 0;
  const sharePct = cc > 0 ? Math.round((vc / cc) * 1000) / 10 : 0;

  return {
    ok: true,
    venue: {
      id: v.id,
      name: v.name,
      package_tier: v.package_tier || 'free',
      city: v.city,
    },
    window_days: windowDays,
    venue_ritual_count: vc,
    city_ritual_count: cc,
    share_pct: sharePct,
    districts: districts.rows.map((d) => ({
      name: d.district,
      ritualsCount: d.rituals_count,
      attendees: d.attendees,
      intensity:
        d.rituals_count > 0 ? Math.round(Number(d.attendees) / Number(d.rituals_count)) : 0,
    })),
  };
}
