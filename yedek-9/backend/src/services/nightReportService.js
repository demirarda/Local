/**
 * Gece Raporu v2 — LOCAL v2 §8 gün-sonu digest
 */
import pool from '../config/database.js';
import LOCAL_CONFIG from '../config/localConfig.js';
import { hasPackageFeature, resolveTierFromVenue, loadVenuePackageRow } from './venuePackageService.js';

function feelingBucket(feeling) {
  const f = String(feeling || '').toLowerCase();
  if (f === 'green' || f === 'g' || f === 'iyi') return 'green';
  if (f === 'yellow' || f === 'y' || f === 'orta') return 'yellow';
  if (f === 'red' || f === 'r' || f === 'kotu' || f === 'kötü') return 'red';
  return null;
}

/** Full day-end digest for OPERATOR+; FREE gets one-shot mini after slot night */
export async function buildNightReport(venueId, { date = new Date(), mini = false, consumeMini = true } = {}) {
  const day = new Date(date).toISOString().slice(0, 10);
  const venue = await loadVenuePackageRow(venueId);
  if (!venue) {
    const err = new Error('Venue not found');
    err.status = 404;
    throw err;
  }
  const tier = resolveTierFromVenue(venue);
  const fullAccess = hasPackageFeature(venue, 'gece_raporu') || tier === 'hakim' || tier === 'operator';
  let isMini = mini || (!fullAccess && tier === 'free');

  // FREE: tek seferlik mini — ayda bir slot sonrası bir kez; ikinci istek kilitli teaser
  if (isMini && tier === 'free' && !fullAccess) {
    const monthKey = day.slice(0, 7);
    const freeUsed =
      venue.free_slot_month_key === monthKey && Number(venue.free_slots_used_month) > 0;
    const alreadyConsumed = venue.mini_report_month_key === monthKey;
    if (!freeUsed) {
      return {
        venue_id: venueId,
        date: day,
        generated_at: new Date().toISOString(),
        mode: 'locked',
        status: 'ok',
        teaser: 'FREE mini-rapor: bu ay bir slot açıp Ritual tamamlanınca tadımlık kırılım açılır',
      };
    }
    if (alreadyConsumed && consumeMini) {
      return {
        venue_id: venueId,
        date: day,
        generated_at: new Date().toISOString(),
        mode: 'consumed',
        status: 'ok',
        teaser: 'Bu ayın tek seferlik mini-raporu kullanıldı · OPERATÖR ile her gece tam digest',
      };
    }
  }

  const rituals = await pool.query(
    `SELECT r.id, r.title, r.start_time, r.capacity, r.status,
            (SELECT COUNT(*)::int FROM ritual_attendance ra
              WHERE ra.ritual_id = r.id AND ra.checkin_at IS NOT NULL) AS checked_in,
            (SELECT COUNT(*)::int FROM memories m
              WHERE m.ritual_id = r.id AND COALESCE(m.status,'published') = 'published') AS memory_count
     FROM rituals r
     WHERE r.venue_id = $1 AND DATE(r.start_time AT TIME ZONE 'UTC') = $2::date
       AND r.status::text NOT IN ('cancelled', 'draft')
     ORDER BY r.start_time ASC`,
    [venueId, day]
  );

  const feedback = await pool.query(
    `SELECT COALESCE(f.p2v_feeling, f.p2r_feeling, f.r1_self) AS feeling,
            f.chip_id, f.feedback_type
     FROM feedback f
     JOIN rituals r ON r.id = f.ritual_id
     WHERE r.venue_id = $1 AND DATE(r.start_time AT TIME ZONE 'UTC') = $2::date
       AND f.feedback_type IN ('p2v', 'p2m', 'p2r', 'rq', 'rq_event')`,
    [venueId, day]
  );

  const rqScores = await pool.query(
    `SELECT AVG(
       CASE COALESCE(f.p2r_feeling, '')
         WHEN 'green' THEN 10.0
         WHEN 'yellow' THEN 6.5
         WHEN 'red' THEN 3.0
         ELSE NULL
       END
     )::float AS avg_rq,
     AVG(
       CASE WHEN f.feedback_type = 'rq_event' THEN
         CASE COALESCE(f.p2r_feeling, '')
           WHEN 'green' THEN 10.0
           WHEN 'yellow' THEN 6.5
           WHEN 'red' THEN 3.0
           ELSE NULL
         END
       END
     )::float AS avg_event_general
     FROM feedback f
     JOIN rituals r ON r.id = f.ritual_id
     WHERE r.venue_id = $1 AND DATE(r.start_time AT TIME ZONE 'UTC') = $2::date
       AND f.feedback_type IN ('p2r', 'rq', 'rq_event')`,
    [venueId, day]
  );

  const checkins = await pool.query(
    `SELECT ra.user_id, COUNT(*) OVER (PARTITION BY ra.user_id) AS visits_here
     FROM ritual_attendance ra
     JOIN rituals r ON r.id = ra.ritual_id
     WHERE r.venue_id = $1
       AND DATE(r.start_time AT TIME ZONE 'UTC') = $2::date
       AND ra.checkin_at IS NOT NULL`,
    [venueId, day]
  );

  const audience = await pool.query(
    `SELECT vs.audience_tag, COUNT(*)::int AS n
     FROM venue_slots vs
     JOIN rituals r ON r.id = vs.ritual_id
     WHERE r.venue_id = $1 AND DATE(r.start_time AT TIME ZONE 'UTC') = $2::date
       AND vs.audience_tag IS NOT NULL
     GROUP BY vs.audience_tag`,
    [venueId, day]
  ).catch(() => ({ rows: [] }));

  const regulars = await pool.query(
    `SELECT COUNT(*)::int AS n FROM venue_regulars
     WHERE venue_id = $1 AND is_regular = true
       AND (regular_since::date = $2::date OR last_checkin_at::date = $2::date)`,
    [venueId, day]
  ).catch(() => ({ rows: [{ n: 0 }] }));

  const chipCounts = {};
  const feelingTotals = { green: 0, yellow: 0, red: 0 };
  for (const row of feedback.rows) {
    const b = feelingBucket(row.feeling);
    if (b) feelingTotals[b] += 1;
    if (row.chip_id) {
      chipCounts[row.chip_id] = (chipCounts[row.chip_id] || 0) + 1;
    }
  }
  const chipSorted = Object.entries(chipCounts).sort((a, b) => b[1] - a[1]);
  const topChip = chipSorted[0] ? { chip_id: chipSorted[0][0], count: chipSorted[0][1] } : null;
  const attentionChip = chipSorted.length > 1
    ? { chip_id: chipSorted[chipSorted.length - 1][0], count: chipSorted[chipSorted.length - 1][1] }
    : null;

  const uniqueUsers = new Set(checkins.rows.map((r) => r.user_id));
  let returning = 0;
  for (const uid of uniqueUsers) {
    const prior = await pool.query(
      `SELECT 1 FROM ritual_attendance ra
       JOIN rituals r ON r.id = ra.ritual_id
       WHERE r.venue_id = $1 AND ra.user_id = $2 AND ra.checkin_at IS NOT NULL
         AND DATE(r.start_time AT TIME ZONE 'UTC') < $3::date
       LIMIT 1`,
      [venueId, uid, day]
    );
    if (prior.rows.length) returning += 1;
  }
  const newCount = Math.max(0, uniqueUsers.size - returning);

  const ritualRows = rituals.rows.map((r) => ({
    id: r.id,
    title: r.title,
    start_time: r.start_time,
    nabiz: r.checked_in,
    doluluk: r.capacity > 0 ? Math.round((r.checked_in / r.capacity) * 100) : null,
    memory_count: r.memory_count,
  }));

  const audienceTotal = audience.rows.reduce((s, a) => s + Number(a.n), 0) || 0;
  const uniN = Number(audience.rows.find((a) => a.audience_tag === 'UNI_FRIENDLY')?.n || 0);
  const intlN = Number(audience.rows.find((a) => a.audience_tag === 'INTERNATIONAL')?.n || 0);

  const offsetMin = LOCAL_CONFIG.venue?.PACKAGES_STUB?.NIGHT_REPORT_OFFSET_MIN ?? 30;
  const closing = venue.closing_time || null;

  const metrics = {
    ritual_count: rituals.rows.length,
    checked_in: uniqueUsers.size,
    feedback_count: feedback.rows.length,
    feeling_totals: feelingTotals,
    top_chip: topChip,
    attention_chip: attentionChip,
    new_vs_returning: { new: newCount, returning },
    regular_motion: Number(regulars.rows[0]?.n || 0),
    audience_aggregate: {
      uni_pct: audienceTotal ? Math.round((uniN / audienceTotal) * 100) : 0,
      intl_pct: audienceTotal ? Math.round((intlN / audienceTotal) * 100) : 0,
      sample: audienceTotal,
    },
  };

  const aura = {
    avg_rq: rqScores.rows[0]?.avg_rq != null ? Number(Number(rqScores.rows[0].avg_rq).toFixed(2)) : null,
    avg_event_general:
      rqScores.rows[0]?.avg_event_general != null
        ? Number(Number(rqScores.rows[0].avg_event_general).toFixed(2))
        : null,
    ring: 'day',
  };

  if (isMini) {
    if (tier === 'free' && consumeMini) {
      const monthKey = day.slice(0, 7);
      await pool.query(
        `UPDATE venues SET mini_report_month_key = $2 WHERE id = $1`,
        [venueId, monthKey]
      ).catch(() => {});
    }
    return {
      venue_id: venueId,
      date: day,
      generated_at: new Date().toISOString(),
      mode: 'mini',
      status: 'ok',
      gunun_aurasi: aura,
      metrics: {
        ritual_count: metrics.ritual_count,
        checked_in: metrics.checked_in,
        feeling_totals: metrics.feeling_totals,
      },
      rituals: ritualRows.slice(0, 3),
      teaser: 'OPERATÖR paketi ile tam Gece Raporu + Aylık Nabız',
      schedule: { closing_time: closing, offset_min: offsetMin },
      one_shot: true,
    };
  }

  return {
    venue_id: venueId,
    date: day,
    generated_at: new Date().toISOString(),
    mode: 'full',
    status: 'ok',
    gunun_aurasi: aura,
    rituals: ritualRows,
    metrics,
    schedule: { closing_time: closing, offset_min: offsetMin },
  };
}

/** Push digest to venue managers at close + offset (cron entrypoint) */
export async function dispatchDueNightReports({ now = new Date() } = {}) {
  const offset = LOCAL_CONFIG.venue?.PACKAGES_STUB?.NIGHT_REPORT_OFFSET_MIN ?? 30;
  const venues = await pool.query(
    `SELECT v.id, v.closing_time, v.subscription_tier, v.pro_enabled, v.city_partner_enabled
     FROM venues v
     WHERE v.closing_time IS NOT NULL
       AND (v.pro_enabled = true OR v.subscription_tier::text IN ('operator','hakim','pro','city_partner'))`
  );
  const { notifyNightReport } = await import('./notifications.js');
  let sent = 0;
  for (const v of venues.rows) {
    if (!hasPackageFeature(v, 'gece_raporu') && resolveTierFromVenue(v) === 'free') continue;
    const [hh, mm] = String(v.closing_time).split(':').map(Number);
    const target = new Date(now);
    target.setHours(hh || 0, (mm || 0) + offset, 0, 0);
    if (Math.abs(target.getTime() - now.getTime()) > 15 * 60 * 1000) continue;
    const report = await buildNightReport(v.id, { date: now });
    const managers = await pool.query(`SELECT user_id FROM venue_managers WHERE venue_id = $1`, [v.id]);
    for (const m of managers.rows) {
      await notifyNightReport(m.user_id, report).catch(() => {});
      sent += 1;
    }
  }
  return { ok: true, sent };
}
