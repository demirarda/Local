/**
 * Rater-desen + eş-kaynak P2V küme — otomatik ceza yok, yalnız MOD sinyali.
 */
import pool from '../config/database.js';
import LOCAL_CONFIG from '../config/localConfig.js';

export async function maybeSignalRaterPattern({ fromUserId, toUserId }) {
  const nMin = Number(LOCAL_CONFIG.fl.RATER_PATTERN_N || 4);
  const ratioMin = Number(LOCAL_CONFIG.fl.RATER_PATTERN_RED_RATIO || 0.8);
  const r = await pool.query(
    `SELECT
       COUNT(*)::int AS n,
       COUNT(*) FILTER (
         WHERE q1_comfort = 'red' OR q2_energy = 'red'
       )::int AS red_n
     FROM feedback
     WHERE from_user_id = $1 AND to_user_id = $2
       AND feedback_type IN ('p2p', 'p2host')`,
    [fromUserId, toUserId]
  );
  const n = Number(r.rows[0]?.n || 0);
  const redN = Number(r.rows[0]?.red_n || 0);
  if (n < nMin) return { signaled: false };
  const ratio = redN / n;
  if (ratio < ratioMin) return { signaled: false };
  const { createReport } = await import('./modEngine.js');
  await createReport({
    reporterId: toUserId,
    targetType: 'user',
    targetId: fromUserId,
    categoryKey: 'rater_pattern',
    description: 'Rater pattern: high red ratio (auto signal, no auto penalty)',
    packageData: { n, red_n: redN, ratio, auto: true },
  });
  return { signaled: true, n, ratio };
}

export async function maybeSignalP2vCluster({ ritualId, fromUserId }) {
  const minN = Number(LOCAL_CONFIG.venue.CLUSTER_RED_MIN || 3);
  const ritual = await pool.query(
    `SELECT id, venue_id, start_time FROM rituals WHERE id = $1`,
    [ritualId]
  );
  const row = ritual.rows[0];
  if (!row?.venue_id) return { signaled: false };

  const reds = await pool.query(
    `SELECT DISTINCT COALESCE(f.from_user_id, f.rater_id, f.user_id) AS uid
     FROM feedback f
     JOIN rituals r ON r.id = f.ritual_id
     WHERE r.venue_id = $1
       AND f.feedback_type = 'p2v'
       AND COALESCE(f.p2v_feeling, f.p2r_feeling) = 'red'
       AND r.start_time::date = $2::date`,
    [row.venue_id, row.start_time]
  );
  const ids = reds.rows.map((x) => String(x.uid)).filter(Boolean);
  if (ids.length < minN) return { signaled: false };

  const fl = await pool.query(
    `SELECT COUNT(*)::int AS c
     FROM friendships
     WHERE status = 'accepted'
       AND friendship_level::text IN ('l1', 'l2', 'l3')
       AND requester_id = ANY($1::uuid[])
       AND receiver_id = ANY($1::uuid[])`,
    [ids]
  );
  if (Number(fl.rows[0]?.c || 0) < minN - 1) return { signaled: false };

  const { createReport } = await import('./modEngine.js');
  await createReport({
    reporterId: fromUserId,
    targetType: 'venue',
    targetId: row.venue_id,
    ritualId,
    categoryKey: 'p2v_cluster',
    description: 'Coordinated red P2V cluster from same FL network (auto signal)',
    packageData: { n: ids.length, auto: true },
  });
  return { signaled: true };
}

const FEELING_VAL = { green: 1, yellow: 0.5, red: 0 };

/** R1-vs-RQ sapması — bugün skora sıfır etki; rater-güvenilirliği hammaddesi. */
export async function maybeLogR1RqCalibration({ userId, ritualId }) {
  if (!userId || !ritualId) return { logged: false };
  try {
    const r = await pool.query(
      `SELECT
         MAX(CASE WHEN feedback_type IN ('p2r', 'rq') THEN COALESCE(p2r_feeling, r1_self) END) AS rq,
         MAX(CASE WHEN feedback_type = 'r1_self' THEN r1_self END) AS r1
       FROM feedback
       WHERE ritual_id = $1 AND from_user_id = $2`,
      [ritualId, userId]
    );
    const rq = r.rows[0]?.rq;
    const r1 = r.rows[0]?.r1;
    if (!rq || !r1) return { logged: false };
    const rqV = FEELING_VAL[String(rq).toLowerCase()];
    const r1V = FEELING_VAL[String(r1).toLowerCase()];
    if (rqV == null || r1V == null) return { logged: false };
    const delta = Number((r1V - rqV).toFixed(3));
    await pool.query(
      `INSERT INTO rater_calibration_log (user_id, ritual_id, r1_value, rq_value, delta)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, ritual_id) DO UPDATE SET
         r1_value = EXCLUDED.r1_value,
         rq_value = EXCLUDED.rq_value,
         delta = EXCLUDED.delta,
         created_at = NOW()`,
      [userId, ritualId, r1V, rqV, delta]
    );
    return { logged: true, delta };
  } catch (_e) {
    return { logged: false, skipped: true };
  }
}
