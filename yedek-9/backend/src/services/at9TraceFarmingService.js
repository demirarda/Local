/**
 * §10 AT-9 — tek-tık-iz farming izleme. Skora dokunmaz; no-peer pozitifin
 * iz envanterini (R1 ∨ RQ ∨ memory) sayar.
 */
import pool from '../config/database.js';

export function classifyNoPeerTrace({
  noPeerPath,
  hasR1,
  hasRq,
  hasMemory,
  delta,
  engagementBlocked,
} = {}) {
  const r1 = Boolean(hasR1);
  const rq = Boolean(hasRq);
  const mem = Boolean(hasMemory);
  const traces = [r1 ? 'r1' : null, rq ? 'rq' : null, mem ? 'memory' : null].filter(Boolean);
  const traceN = traces.length;
  const oneTap = traceN === 1;
  const positive = Number(delta) > 0;
  const farmWatch = Boolean(noPeerPath) && positive && !engagementBlocked && oneTap;
  let bucket = 'peer_path';
  if (noPeerPath) {
    if (traceN === 0) bucket = 'no_trace';
    else if (oneTap) bucket = `one_tap_${traces[0]}`;
    else if (traceN === 2) bucket = 'two_traces';
    else bucket = 'full_trace';
  }
  return {
    traces,
    trace_n: traceN,
    one_tap: oneTap,
    farm_watch: farmWatch,
    bucket,
  };
}

function num(row, key) {
  return Number(row?.[key] || 0);
}

export async function buildAt9TraceFarmingReport({ windowDays = 30 } = {}) {
  const days = Math.min(180, Math.max(1, Number(windowDays) || 30));
  const empty = {
    window_days: days,
    no_peer_positive: 0,
    one_tap_positive: 0,
    one_tap_rate: 0,
    buckets: {
      one_tap_r1: 0,
      one_tap_rq: 0,
      one_tap_memory: 0,
      two_traces: 0,
      full_trace: 0,
      no_trace: 0,
    },
    repeat_users: [],
    enters_rs: false,
    note: 'AT-9 izleme — tek-tık iz farming oranı. Formül/oturum kararı değil.',
  };
  try {
    const agg = await pool.query(
      `WITH rows AS (
         SELECT
           user_id,
           COALESCE(delta, 0) AS delta,
           COALESCE((inputs->>'no_peer_path')::boolean, false) AS no_peer,
           COALESCE((breakdown->>'has_r1')::boolean, false) AS has_r1,
           COALESCE((breakdown->>'has_rq')::boolean, false) AS has_rq,
           COALESCE((breakdown->>'has_memory')::boolean, false) AS has_memory,
           COALESCE((breakdown->>'engagement_blocked')::boolean, false) AS blocked
         FROM score_events
         WHERE event_type = 'rs_ritual'
           AND created_at >= NOW() - ($1 || ' days')::interval
       ),
       pos AS (
         SELECT *
         FROM rows
         WHERE no_peer AND delta > 0 AND NOT blocked
       )
       SELECT
         COUNT(*)::int AS no_peer_positive,
         COUNT(*) FILTER (
           WHERE (has_r1::int + has_rq::int + has_memory::int) = 1
         )::int AS one_tap_positive,
         COUNT(*) FILTER (WHERE has_r1 AND NOT has_rq AND NOT has_memory)::int AS one_tap_r1,
         COUNT(*) FILTER (WHERE has_rq AND NOT has_r1 AND NOT has_memory)::int AS one_tap_rq,
         COUNT(*) FILTER (WHERE has_memory AND NOT has_r1 AND NOT has_rq)::int AS one_tap_memory,
         COUNT(*) FILTER (
           WHERE (has_r1::int + has_rq::int + has_memory::int) = 2
         )::int AS two_traces,
         COUNT(*) FILTER (
           WHERE has_r1 AND has_rq AND has_memory
         )::int AS full_trace,
         COUNT(*) FILTER (
           WHERE NOT has_r1 AND NOT has_rq AND NOT has_memory
         )::int AS no_trace
       FROM pos`,
      [String(days)]
    );
    const repeat = await pool.query(
      `WITH pos AS (
         SELECT
           user_id,
           COALESCE((breakdown->>'has_r1')::boolean, false) AS has_r1,
           COALESCE((breakdown->>'has_rq')::boolean, false) AS has_rq,
           COALESCE((breakdown->>'has_memory')::boolean, false) AS has_memory
         FROM score_events
         WHERE event_type = 'rs_ritual'
           AND created_at >= NOW() - ($1 || ' days')::interval
           AND COALESCE((inputs->>'no_peer_path')::boolean, false)
           AND COALESCE(delta, 0) > 0
           AND NOT COALESCE((breakdown->>'engagement_blocked')::boolean, false)
           AND (
             COALESCE((breakdown->>'has_r1')::boolean, false)::int
             + COALESCE((breakdown->>'has_rq')::boolean, false)::int
             + COALESCE((breakdown->>'has_memory')::boolean, false)::int
           ) = 1
       )
       SELECT user_id, COUNT(*)::int AS one_tap_n
       FROM pos
       GROUP BY user_id
       HAVING COUNT(*) >= 3
       ORDER BY one_tap_n DESC
       LIMIT 20`,
      [String(days)]
    );
    const row = agg.rows[0] || {};
    const noPeerPos = num(row, 'no_peer_positive');
    const oneTap = num(row, 'one_tap_positive');
    return {
      ...empty,
      no_peer_positive: noPeerPos,
      one_tap_positive: oneTap,
      one_tap_rate: noPeerPos > 0 ? Number((oneTap / noPeerPos).toFixed(4)) : 0,
      buckets: {
        one_tap_r1: num(row, 'one_tap_r1'),
        one_tap_rq: num(row, 'one_tap_rq'),
        one_tap_memory: num(row, 'one_tap_memory'),
        two_traces: num(row, 'two_traces'),
        full_trace: num(row, 'full_trace'),
        no_trace: num(row, 'no_trace'),
      },
      repeat_users: repeat.rows.map((r) => ({
        user_id: r.user_id,
        one_tap_n: Number(r.one_tap_n) || 0,
      })),
    };
  } catch (_e) {
    return { ...empty, skipped: true };
  }
}
