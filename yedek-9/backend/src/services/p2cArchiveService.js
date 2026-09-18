/**
 * §7 P2C — hiçbir skora değil.
 * Destinasyon: arşiv-künyesi + zone-aday ısı-haritası (ops).
 */
import pool from '../config/database.js';
import LOCAL_CONFIG from '../config/localConfig.js';

const FEELING_RANK = { green: 1, yellow: 0.5, red: 0 };

function modeFeeling(counts) {
  const g = Number(counts.green) || 0;
  const y = Number(counts.yellow) || 0;
  const r = Number(counts.red) || 0;
  const n = g + y + r;
  if (n <= 0) return null;
  const top = Math.max(g, y, r);
  const winners = [
    g === top ? 'green' : null,
    y === top ? 'yellow' : null,
    r === top ? 'red' : null,
  ].filter(Boolean);
  if (winners.length !== 1) return 'mixed';
  return winners[0];
}

/**
 * Ritual arşiv künyesi — renk etiketi, skor yok.
 */
export async function getP2cArchiveTag(ritualId) {
  if (!ritualId) return null;
  try {
    const r = await pool.query(
      `SELECT
         COUNT(*)::int AS n,
         COUNT(*) FILTER (WHERE LOWER(COALESCE(p2r_feeling, p2v_feeling, '')) = 'green')::int AS green,
         COUNT(*) FILTER (WHERE LOWER(COALESCE(p2r_feeling, p2v_feeling, '')) = 'yellow')::int AS yellow,
         COUNT(*) FILTER (WHERE LOWER(COALESCE(p2r_feeling, p2v_feeling, '')) = 'red')::int AS red
       FROM feedback
       WHERE ritual_id = $1 AND feedback_type = 'p2c'`,
      [ritualId]
    );
    const row = r.rows[0] || {};
    const n = Number(row.n) || 0;
    if (n <= 0) return null;
    const feeling = modeFeeling(row);
    return {
      kind: 'p2c',
      n,
      feeling,
      green: Number(row.green) || 0,
      yellow: Number(row.yellow) || 0,
      red: Number(row.red) || 0,
      score: null,
      enters_trust: false,
      enters_aura: false,
      enters_rs: false,
      label: feeling ? `Zemin · ${feeling}` : 'Zemin',
    };
  } catch (_e) {
    return null;
  }
}

/**
 * Custom-pin P2C ızgarası — zone-aday ısı; skor üretmez.
 */
export async function buildP2cZoneCandidateHeatmap({
  windowDays = LOCAL_CONFIG.venue?.WINDOW_DAYS || 120,
  city = null,
} = {}) {
  const days = Math.max(7, Number(windowDays) || 120);
  const params = [String(days)];
  let cityClause = '';
  if (city) {
    params.push(String(city));
    cityClause = 'AND LOWER(COALESCE(r.host_city, r.city, \'\')) = LOWER($2)';
  }
  const r = await pool.query(
    `SELECT
       ROUND(r.location_lat::numeric, 2) AS lat,
       ROUND(r.location_lng::numeric, 2) AS lng,
       COUNT(*)::int AS n,
       COUNT(*) FILTER (WHERE LOWER(COALESCE(f.p2r_feeling, f.p2v_feeling, '')) = 'green')::int AS green,
       COUNT(*) FILTER (WHERE LOWER(COALESCE(f.p2r_feeling, f.p2v_feeling, '')) = 'yellow')::int AS yellow,
       COUNT(*) FILTER (WHERE LOWER(COALESCE(f.p2r_feeling, f.p2v_feeling, '')) = 'red')::int AS red,
       COUNT(DISTINCT r.id)::int AS ritual_n
     FROM feedback f
     JOIN rituals r ON r.id = f.ritual_id
     WHERE f.feedback_type = 'p2c'
       AND r.venue_id IS NULL
       AND r.zone_id IS NULL
       AND COALESCE(r.is_home, false) = false
       AND r.location_lat IS NOT NULL
       AND r.location_lng IS NOT NULL
       AND COALESCE(f.submitted_at, f.created_at) >= NOW() - ($1::text || ' days')::interval
       ${cityClause}
     GROUP BY 1, 2
     HAVING COUNT(DISTINCT r.id) >= 2 AND COUNT(DISTINCT COALESCE(f.user_id, f.rater_id)) >= 4
     ORDER BY n DESC
     LIMIT 200`,
    params
  ).catch(() => ({ rows: [] }));

  const cells = r.rows.map((row) => {
    const n = Number(row.n) || 0;
    const heat =
      n > 0
        ? Number(
            (
              ((Number(row.green) || 0) * FEELING_RANK.green +
                (Number(row.yellow) || 0) * FEELING_RANK.yellow +
                (Number(row.red) || 0) * FEELING_RANK.red) /
              n
            ).toFixed(3)
          )
        : null;
    return {
      lat: Number(row.lat),
      lng: Number(row.lng),
      n,
      ritual_n: Number(row.ritual_n) || 0,
      green: Number(row.green) || 0,
      yellow: Number(row.yellow) || 0,
      red: Number(row.red) || 0,
      /** 0–1 ops ısı; Trust/Aura/RS değil */
      heat,
      score: null,
    };
  });

  return {
    kind: 'p2c_zone_candidate',
    window_days: days,
    city: city || null,
    cells,
    n_cells: cells.length,
    enters_trust: false,
    enters_aura: false,
    enters_rs: false,
  };
}
