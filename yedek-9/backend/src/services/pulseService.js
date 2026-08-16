/**
 * v2 §2 Nabız — PRELOBBY / LIVE / ARCHIVE değerleri
 */
import pool from '../config/database.js';
import LOCAL_CONFIG from '../config/localConfig.js';

export function mixLivePulse(checkinRatio, memoryTempo) {
  const mix = LOCAL_CONFIG.pulse?.LIVE_MIX || { checkin_weight: 0.55, memory_tempo_weight: 0.45 };
  const c = Math.max(0, Math.min(1, Number(checkinRatio) || 0));
  const m = Math.max(0, Math.min(1, Number(memoryTempo) || 0));
  const wC = Number(mix.checkin_weight) || 0.55;
  const wM = Number(mix.memory_tempo_weight) || 0.45;
  const sum = wC + wM || 1;
  return (wC / sum) * c + (wM / sum) * m;
}

function clamp01(n) {
  return Math.max(0, Math.min(1, Number(n) || 0));
}

/**
 * §15 — ring fill = RQ % continuously; fallback occupancy / live mix when no RQ.
 */
export function resolvePulseRingFill({ rqAverage = null, ratio = 0 } = {}) {
  if (rqAverage != null && rqAverage !== '' && Number.isFinite(Number(rqAverage))) {
    return clamp01(rqAverage);
  }
  return clamp01(ratio);
}

/**
 * Compute pulse metrics for a ritual (occupancy, check-in ratio, memory tempo, RQ avg).
 */
export async function computeRitualPulse(ritualId, ritualRow = null) {
  let ritual = ritualRow;
  if (!ritual) {
    const r = await pool.query(
      `SELECT id, capacity, status, start_time, duration, end_time
       FROM rituals WHERE id = $1`,
      [ritualId]
    );
    ritual = r.rows[0];
  }
  if (!ritual) {
    return {
      mode: 'PRELOBBY',
      occupancy_ratio: 0,
      checkin_ratio: 0,
      memory_tempo: 0,
      rq_average: null,
      live_value: 0,
      value: 0,
      count: 0,
    };
  }

  const capacity = Math.max(1, Number(ritual.capacity) || 1);
  const att = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE status NOT IN ('no_show', 'cancelled'))::int AS registered,
       COUNT(*) FILTER (WHERE checkin_at IS NOT NULL)::int AS checked_in
     FROM ritual_attendance
     WHERE ritual_id = $1`,
    [ritualId]
  );
  const registered = Number(att.rows[0]?.registered) || 0;
  const checkedIn = Number(att.rows[0]?.checked_in) || 0;
  const occupancyRatio = Math.min(1, registered / capacity);
  const checkinRatio = registered > 0 ? Math.min(1, checkedIn / registered) : 0;

  const freshHours = LOCAL_CONFIG.pulse?.FRESH_HOURS ?? 24;
  const mem = await pool.query(
    `SELECT
       COUNT(*) FILTER (
         WHERE COALESCE(published_at, created_at) > NOW() - ($2 || ' hours')::interval
           AND COALESCE(status, 'published') = 'published'
       )::int AS fresh_count,
       COUNT(*) FILTER (WHERE COALESCE(status, 'published') = 'published')::int AS total_count
     FROM memories
     WHERE ritual_id = $1 AND memory_type = 'ritual'`,
    [ritualId, String(freshHours)]
  );
  const freshCount = Number(mem.rows[0]?.fresh_count) || 0;
  // Tempo: fresh memories relative to capacity (capped)
  const memoryTempo = Math.min(1, freshCount / Math.max(3, Math.min(capacity, 10)));

  let rqAverage = null;
  try {
    // §15 RQ: 🟢1.0 / 🟡0.5 / 🔴0.0
    const rq = await pool.query(
      `SELECT AVG(
         CASE COALESCE(p2r_feeling, q1_comfort, '')
           WHEN 'green' THEN 1.0
           WHEN 'yellow' THEN 0.5
           WHEN 'red' THEN 0.0
           ELSE NULL
         END
       )::float AS avg_rq
       FROM feedback
       WHERE ritual_id = $1`,
      [ritualId]
    );
    if (rq.rows[0]?.avg_rq != null) {
      rqAverage = Math.max(0, Math.min(1, Number(rq.rows[0].avg_rq)));
    }
  } catch (_e) {
    rqAverage = null;
  }

  const status = String(ritual.status || '').toLowerCase();
  const now = new Date();
  const start = ritual.start_time ? new Date(ritual.start_time) : null;
  const live =
    status === 'live' ||
    status === 'active' ||
    (start && now >= start && !['archived', 'ended', 'cancelled', 'collapsed'].includes(status));
  const archive = ['archived', 'ended', 'window'].includes(status) || status === 'completed';

  let mode = 'PRELOBBY';
  if (archive) mode = 'ARCHIVE';
  else if (live) mode = 'LIVE';

  const liveValue = mixLivePulse(checkinRatio, memoryTempo);
  const fallback = rqAverage == null && mode === 'LIVE' ? liveValue : occupancyRatio;
  const value = resolvePulseRingFill({ rqAverage, ratio: fallback });

  return {
    mode,
    occupancy_ratio: Math.round(occupancyRatio * 1000) / 1000,
    checkin_ratio: Math.round(checkinRatio * 1000) / 1000,
    memory_tempo: Math.round(memoryTempo * 1000) / 1000,
    rq_average: rqAverage != null ? Math.round(rqAverage * 1000) / 1000 : null,
    live_value: Math.round(liveValue * 1000) / 1000,
    /** §15 primary fill for ritual card ring */
    value: Math.round(value * 1000) / 1000,
    count: registered,
    live_mix: {
      checkin_weight: LOCAL_CONFIG.pulse?.LIVE_MIX?.checkin_weight ?? 0.55,
      memory_tempo_weight: LOCAL_CONFIG.pulse?.LIVE_MIX?.memory_tempo_weight ?? 0.45,
    },
    bands: { ...(LOCAL_CONFIG.pulse?.BANDS || { low: 0.4, mid: 0.7 }) },
  };
}
