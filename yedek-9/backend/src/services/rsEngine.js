import pool from '../config/database.js';
import redis from '../config/redis.js';
import {
  RS_CONSTANTS,
  LOCAL_CONFIG,
  clampRawDelta,
  computeRsPipeline,
  rawDeltaFromTruthSignal,
  aisFromAttendanceRow,
  fbWeightFromLevel,
  blendIqFromRaw,
  blendCf,
  applyNoPeerEngagementGate,
  computeTruthSignalFromComponents,
  ifLateFromCount,
  applyIfModL3,
  applyIfPeerRedHeavy,
  clampDayPositiveDelta,
  applyFarToDelta,
  farPhase,
} from '../config/localConfig.js';
import { getFeedbackClosesAt } from './feedbackWindow.js';
import { getPlacementCompleteMap } from './rsVisibility.js';
import {
  getDiversityMultiplierFromState,
  calculateNContextScore,
  shouldFreezePositiveDelta,
} from './antiGaming.js';
import { updateDsForUser } from './dsEngine.js';
import { notifyMaturationUpgrade, notifyRSChange } from './notifications.js';
import { logScoreEvent, logRsPipelineScoreEvents } from './scoreEventService.js';

export { RS_CONSTANTS };

const BC5_WEIGHTS = LOCAL_CONFIG.rs.BC5_WEIGHTS;

function normalizeAnswer(answer) {
  if (answer === 'green') return 1.0;
  if (answer === 'yellow') return 0.5;
  if (answer === 'red') return 0.0;
  return 0.5;
}

function feedbackRowWeight(row) {
  if (row.rs_weight != null && Number.isFinite(Number(row.rs_weight))) {
    return Number(row.rs_weight);
  }
  if (row.friendship_level) {
    const seals = row.co_seal_count != null ? Number(row.co_seal_count) : null;
    return fbWeightFromLevel(row.friendship_level, seals);
  }
  return 1.0;
}

async function sharedRitualCount(userId, otherUserId) {
  const r = await pool.query(
    `SELECT COUNT(DISTINCT ra1.ritual_id)::int AS c
     FROM ritual_attendance ra1
     INNER JOIN ritual_attendance ra2
       ON ra1.ritual_id = ra2.ritual_id
     WHERE ra1.user_id = $1 AND ra2.user_id = $2
       AND ra1.status NOT IN ('no_show', 'cancelled')
       AND ra2.status NOT IN ('no_show', 'cancelled')`,
    [userId, otherUserId]
  );
  return r.rows[0]?.c ?? 0;
}

/** Sealed table presence — RS runs after close; status is rarely still `confirmed`. */
function isLiveWindowStatus(status) {
  const s = String(status || '');
  return s !== 'no_show' && s !== 'cancelled';
}

async function getRitualGroupQAverage(ritualId) {
  const r = await pool.query(
    `SELECT q1_comfort, q2_energy FROM feedback
     WHERE ritual_id = $1 AND feedback_type IN ('p2p', 'p2host')`,
    [ritualId]
  );
  const vals = [];
  for (const row of r.rows) {
    const q1 = row.q1_comfort != null ? normalizeAnswer(row.q1_comfort) : null;
    const q2 = row.q2_energy != null ? normalizeAnswer(row.q2_energy) : null;
    if (q1 != null && q2 != null) vals.push((q1 + q2) / 2);
    else if (q1 != null) vals.push(q1);
    else if (q2 != null) vals.push(q2);
  }
  if (vals.length === 0) return 0.5;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

async function countUniqueRatersLast5Rituals(userId, excludeRitualId) {
  const r = await pool.query(
    `SELECT COUNT(DISTINCT f.from_user_id)::int AS c
     FROM (
       SELECT DISTINCT ritual_id
       FROM rs_delta_history
       WHERE user_id = $1
         AND ritual_id != $2
         AND bypass_reason IS NULL
       ORDER BY created_at DESC
       LIMIT 5
     ) recent
     INNER JOIN feedback f
       ON f.ritual_id = recent.ritual_id
       AND f.to_user_id = $1
       AND f.feedback_type IN ('p2p', 'p2host')`,
    [userId, excludeRitualId]
  );
  return r.rows[0]?.c ?? 0;
}

async function calculateIQ(ritualId, userId, completedRitualsBefore) {
  const eligible = await pool.query(
    `SELECT ra.user_id
     FROM ritual_attendance ra
     INNER JOIN friendships fr ON fr.status = 'accepted'
       AND (
         (fr.requester_id = $2 AND fr.receiver_id = ra.user_id)
         OR (fr.receiver_id = $2 AND fr.requester_id = ra.user_id)
       )
     WHERE ra.ritual_id = $1
       AND ra.user_id <> $2
       AND ra.checkin_at IS NOT NULL
       AND COALESCE(ra.checkin_phase, 'sealed') = 'sealed'
       AND ra.status NOT IN ('no_show', 'cancelled')`,
    [ritualId, userId]
  );
  const eligibleIds = eligible.rows.map((r) => String(r.user_id));
  const eligibleCount = eligibleIds.length;

  if (eligibleCount === 0) {
    return { IQ_r: null, conf: 0, n: 0, IQ_raw: null, eligibleCount: 0, iq_null: true };
  }

  let fb;
  try {
    fb = await pool.query(
      `SELECT f.from_user_id, f.q1_comfort, f.q2_energy, f.rs_weight, f.friendship_level,
              fr.co_seal_count
       FROM feedback f
       LEFT JOIN friendships fr ON fr.status = 'accepted'
         AND (
           (fr.requester_id = f.from_user_id AND fr.receiver_id = f.to_user_id)
           OR (fr.receiver_id = f.from_user_id AND fr.requester_id = f.to_user_id)
         )
       WHERE f.ritual_id = $1 AND f.to_user_id = $2
         AND f.feedback_type IN ('p2p', 'p2host')
         AND f.from_user_id = ANY($3::uuid[])`,
      [ritualId, userId, eligibleIds]
    );
  } catch (_e) {
    fb = await pool.query(
      `SELECT f.from_user_id, f.q1_comfort, f.q2_energy, f.rs_weight, f.friendship_level
       FROM feedback f
       WHERE f.ritual_id = $1 AND f.to_user_id = $2
         AND f.feedback_type IN ('p2p', 'p2host')
         AND f.from_user_id = ANY($3::uuid[])`,
      [ritualId, userId, eligibleIds]
    );
  }

  const weightedAvgs = [];
  for (const row of fb.rows) {
    const fromId = row.from_user_id;
    const att = await pool.query(
      `SELECT status, checkin_at FROM ritual_attendance WHERE ritual_id = $1 AND user_id = $2`,
      [ritualId, fromId]
    );
    if (att.rows.length === 0 || !isLiveWindowStatus(att.rows[0].status)) continue;
    if (!att.rows[0].checkin_at) continue;

    const w = feedbackRowWeight(row);
    if (w <= 0) continue;

    const q1 = row.q1_comfort != null ? normalizeAnswer(row.q1_comfort) : null;
    const q2 = row.q2_energy != null ? normalizeAnswer(row.q2_energy) : null;
    if (q1 == null && q2 == null) continue;
    const avg = q1 != null && q2 != null ? (q1 + q2) / 2 : (q1 ?? q2);
    weightedAvgs.push({ avg, w });
  }

  const n = weightedAvgs.length;
  if (n === 0) {
    return { IQ_r: null, conf: 0, n: 0, IQ_raw: null, eligibleCount, iq_null: true };
  }

  let conf = 0;
  if (n === 1) conf = 0.5;
  else if (n === 2) conf = 0.75;
  else conf = 1.0;

  const uniqueRaters = await countUniqueRatersLast5Rituals(userId, ritualId);
  if (uniqueRaters < 3 && conf > 0) {
    conf = Math.max(0, conf - LOCAL_CONFIG.rs.DIVERSITY_REQ_PENALTY);
  }

  const weightSum = weightedAvgs.reduce((a, x) => a + x.w, 0);
  const weightedSum = weightedAvgs.reduce((a, x) => a + x.avg * x.w, 0);
  const IQ_raw = weightSum > 0 ? weightedSum / weightSum : null;
  const IQ_r = IQ_raw == null ? null : blendIqFromRaw(IQ_raw, n, conf);
  return { IQ_r, conf, n, IQ_raw, eligibleCount, iq_null: false };
}

async function calculateCF(ritualId, userId) {
  const fb = await pool.query(
    `SELECT f.from_user_id, f.q2_energy, f.rs_weight, f.friendship_level
     FROM feedback f
     WHERE f.ritual_id = $1 AND f.to_user_id = $2
       AND f.feedback_type IN ('p2p', 'p2host')
       AND f.q2_energy IS NOT NULL`,
    [ritualId, userId]
  );

  const peerParts = [];
  for (const row of fb.rows) {
    const att = await pool.query(
      `SELECT status FROM ritual_attendance WHERE ritual_id = $1 AND user_id = $2`,
      [ritualId, row.from_user_id]
    );
    if (att.rows.length === 0 || !isLiveWindowStatus(att.rows[0].status)) continue;
    const w = feedbackRowWeight(row);
    if (w <= 0) continue;
    peerParts.push({ q2: normalizeAnswer(row.q2_energy), w });
  }

  let CF_peers = 0.5;
  if (peerParts.length > 0) {
    const s = peerParts.reduce((a, x) => a + x.q2 * x.w, 0);
    const sw = peerParts.reduce((a, x) => a + x.w, 0);
    CF_peers = sw > 0 ? s / sw : 0.5;
  }

  const r1 = await pool.query(
    `SELECT r1_self FROM feedback
     WHERE ritual_id = $1 AND from_user_id = $2 AND feedback_type = 'r1_self'`,
    [ritualId, userId]
  );
  let CF_self = 0.5;
  let hasR1 = false;
  if (r1.rows.length > 0 && r1.rows[0].r1_self != null) {
    CF_self = normalizeAnswer(r1.rows[0].r1_self);
    hasR1 = true;
  } else {
    const p2rLegacy = await pool.query(
      `SELECT p2r_feeling FROM feedback
       WHERE ritual_id = $1 AND from_user_id = $2 AND feedback_type = 'p2r'`,
      [ritualId, userId]
    );
    if (p2rLegacy.rows.length > 0 && p2rLegacy.rows[0].p2r_feeling != null) {
      CF_self = normalizeAnswer(p2rLegacy.rows[0].p2r_feeling);
      hasR1 = true;
    }
  }

  const peerCount = peerParts.length;
  const CF_r = blendCf({ CF_peers, CF_self, peerCount });
  return { CF_r, CF_peers, CF_self, peerCount, hasR1 };
}

async function calculateAttendance(ritualId, userId) {
  const result = await pool.query(
    `SELECT status, ais_score, checkin_manual_fallback, checkin_at, checkin_attempt_at
     FROM ritual_attendance WHERE ritual_id = $1 AND user_id = $2`,
    [ritualId, userId]
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  if (row.status === 'no_show' || row.status === 'cancelled') return null;
  if (!row.checkin_at) return null;

  if (row.ais_score != null) {
    return Number(row.ais_score);
  }

  const ritualQuery = await pool.query(
    `SELECT start_time, duration FROM rituals WHERE id = $1`,
    [ritualId]
  );
  if (ritualQuery.rows.length === 0) return null;
  const ais = aisFromAttendanceRow(
    row,
    ritualQuery.rows[0].start_time,
    Number(ritualQuery.rows[0].duration) || 60
  );
  if (!ais || ais.status === 'no_show') return null;
  return ais.ais;
}

async function calculateMemory(ritualId, userId) {
  const r = await pool.query(
    `SELECT 1 FROM memories
     WHERE ritual_id = $1 AND user_id = $2
       AND (
         memory_type IN ('pulse', 'ritual', 'quote', 'playlist', 'song', 'photo', 'video', 'media')
         OR type::text IN ('pulse', 'quote', 'photo', 'media', 'playlist', 'song', 'video', 'text', 'voice')
         OR spotify_playlist_url IS NOT NULL
         OR content_url IS NOT NULL
         OR COALESCE(content_text, content, '') <> ''
       )
     LIMIT 1`,
    [ritualId, userId]
  );
  return r.rows.length > 0 ? 1.0 : 0.0;
}

async function ritualEnded(ritualId) {
  const r = await pool.query(
    `SELECT start_time, duration FROM rituals WHERE id = $1`,
    [ritualId]
  );
  if (r.rows.length === 0) return false;
  const end = new Date(r.rows[0].start_time);
  end.setMinutes(end.getMinutes() + (r.rows[0].duration || 0));
  return new Date() > end;
}

/** son-part.md §4.4 — feedback IF after window closes */
async function feedbackPenaltyWindowElapsed(ritualId) {
  const r = await pool.query(`SELECT * FROM rituals WHERE id = $1`, [ritualId]);
  if (r.rows.length === 0) return false;
  const closesAt = getFeedbackClosesAt(r.rows[0]);
  return new Date() > closesAt;
}

async function userSubmittedFeedback(ritualId, userId) {
  const r = await pool.query(
    `SELECT 1 FROM feedback WHERE ritual_id = $1 AND from_user_id = $2 LIMIT 1`,
    [ritualId, userId]
  );
  return r.rows.length > 0;
}

/**
 * Master Parametre §4 — EMPTY_FB görevi yalnız FL1/FL2 peer (rater) varken doğar.
 * FL3 / stranger / yalnız solo → boş-feedback IF uygulanmaz.
 */
async function hasFl12RaterAtRitual(ritualId, userId) {
  const r = await pool.query(
    `SELECT 1
     FROM ritual_attendance ra
     INNER JOIN friendships f
       ON f.status = 'accepted'
      AND f.friendship_level::text IN ('l1', 'l2')
      AND (
        (f.requester_id = $2 AND f.receiver_id = ra.user_id)
        OR (f.receiver_id = $2 AND f.requester_id = ra.user_id)
      )
     WHERE ra.ritual_id = $1
       AND ra.user_id <> $2
       AND ra.checkin_at IS NOT NULL
       AND ra.status NOT IN ('no_show', 'cancelled')
     LIMIT 1`,
    [ritualId, userId]
  );
  return r.rows.length > 0;
}

/** §1 MOD-L3 — aktif full_suspend L3 varsa IF=1.0. Tablo yoksa fail-open. */
async function hasActiveModL3(userId) {
  try {
    const r = await pool.query(
      `SELECT 1
       FROM mod_sanctions
       WHERE user_id = $1
         AND level = 'L3'
         AND active = true
         AND (ends_at IS NULL OR ends_at > NOW())
       LIMIT 1`,
      [userId]
    );
    return r.rows.length > 0;
  } catch (e) {
    if (e?.code === '42P01' || e?.code === '42703') return false;
    throw e;
  }
}

async function calculateIF(ritualId, userId, { noPeerPath = false } = {}) {
  let ifScore = 0.0;
  const attendanceResult = await pool.query(
    `SELECT status, checkin_at, checkin_attempt_at, attendance_percentage, left_early_at, ais_score
     FROM ritual_attendance WHERE ritual_id = $1 AND user_id = $2`,
    [ritualId, userId]
  );

  if (attendanceResult.rows.length === 0) return 1.0;

  const attendance = attendanceResult.rows[0];
  const ritualQuery = await pool.query(
    `SELECT start_time, duration FROM rituals WHERE id = $1`,
    [ritualId]
  );
  if (ritualQuery.rows.length === 0) {
    const hasL3 = await hasActiveModL3(userId);
    return applyIfModL3(ifScore, hasL3);
  }

  const ritualStartTime = new Date(ritualQuery.rows[0].start_time);
  const ritualDuration = ritualQuery.rows[0].duration || 60;
  const checkInTime = attendance.checkin_at ? new Date(attendance.checkin_at) : null;

  // §6 TEK KÖPRÜ: late IF, deneme/AIS mühüründen; pending tanık gecikmesi sayılmaz.
  const aisResult = aisFromAttendanceRow(attendance, ritualStartTime, ritualDuration);
  const isLateSlice = aisResult?.status === 'late' || aisResult?.status === 'deep_late';
  if (isLateSlice) {
    const windowDays = LOCAL_CONFIG.rs.IF_LATE_WINDOW_DAYS || 30;
    const lateHist = await pool.query(
      `SELECT COUNT(*)::int AS c
       FROM ritual_attendance ra
       JOIN rituals r ON r.id = ra.ritual_id
       WHERE ra.user_id = $1
         AND ra.ritual_id <> $2
         AND ra.ais_score IS NOT NULL
         AND ra.ais_score > 0
         AND ra.ais_score < $3
         AND r.start_time > NOW() - ($4 || ' days')::interval`,
      [userId, ritualId, LOCAL_CONFIG.checkin.AIS_REDUCED, String(windowDays)]
    );
    const priorLate = Number(lateHist.rows[0]?.c || 0);
    ifScore += ifLateFromCount(priorLate + 1);
  } else if (!aisResult && !checkInTime) {
    ifScore += LOCAL_CONFIG.rs.IF_LATE_SLICE;
  }

  if (attendance.left_early_at != null) {
    const priorLeaves = await pool.query(
      `SELECT COUNT(*)::int AS c
       FROM ritual_attendance
       WHERE user_id = $1
         AND ritual_id <> $2
         AND left_early_at IS NOT NULL
         AND left_early_at > NOW() - INTERVAL '30 days'`,
      [userId, ritualId]
    );
    const n = Number(priorLeaves.rows[0]?.c || 0);
    if (n >= 1) {
      let pct = attendance.attendance_percentage;
      if (pct == null && checkInTime) {
        const ritualEndTime = new Date(ritualStartTime.getTime() + ritualDuration * 60000);
        const attendedDuration = (Math.min(Date.now(), ritualEndTime.getTime()) - checkInTime) / 60000;
        pct = (attendedDuration / ritualDuration) * 100;
      }
      if (pct != null && pct < 30) ifScore += 0.15;
    }
  }

  if (
    (await feedbackPenaltyWindowElapsed(ritualId)) &&
    !(await userSubmittedFeedback(ritualId, userId)) &&
    (await hasFl12RaterAtRitual(ritualId, userId))
  ) {
    ifScore += LOCAL_CONFIG.rs.IF_FEEDBACK_MISSING;
  }

  const peerFb = await pool.query(
    `SELECT q1_comfort, q2_energy FROM feedback
     WHERE ritual_id = $1 AND to_user_id = $2
       AND feedback_type IN ('p2p', 'p2host')`,
    [ritualId, userId]
  );
  let redHeavy = false;
  if (peerFb.rows.length > 0) {
    let redSignals = 0;
    let totalSignals = 0;
    for (const row of peerFb.rows) {
      for (const field of ['q1_comfort', 'q2_energy']) {
        if (row[field] == null) continue;
        totalSignals += 1;
        if (row[field] === 'red') redSignals += 1;
      }
    }
    redHeavy = totalSignals > 0 && redSignals / totalSignals >= 0.5;
  }
  ifScore = applyIfPeerRedHeavy(ifScore, { noPeerPath, redHeavy });

  const capped = Math.min(Math.max(ifScore, 0), 1.0);
  const hasL3 = await hasActiveModL3(userId);
  return applyIfModL3(capped, hasL3);
}

async function calculateTruthSignal(ritualId, userId, completedRitualsBefore) {
  const A_r = await calculateAttendance(ritualId, userId);
  if (A_r == null) return null;

  const iq = await calculateIQ(ritualId, userId, completedRitualsBefore);
  const cf = await calculateCF(ritualId, userId);
  const { CF_r } = cf;
  const M_r = await calculateMemory(ritualId, userId);
  const IF_r = await calculateIF(ritualId, userId, { noPeerPath: iq.iq_null === true });

  const rq = await pool.query(
    `SELECT 1 FROM feedback
     WHERE ritual_id = $1 AND from_user_id = $2
       AND feedback_type IN ('p2r', 'rq')
       AND (p2r_feeling IS NOT NULL OR r1_self IS NOT NULL)
     LIMIT 1`,
    [ritualId, userId]
  );
  const hasRq = rq.rows.length > 0;

  const { P_r, T_r, S_r } = computeTruthSignalFromComponents({
    A_r,
    IQ_r: iq.iq_null ? null : iq.IQ_r,
    CF_r,
    M_r,
    IF_r,
  });

  return {
    S_r,
    P_r,
    T_r,
    A_r,
    IQ_r: iq.IQ_r,
    CF_r,
    M_r,
    IF_r,
    iqMeta: iq,
    cfMeta: cf,
    hasRq,
  };
}

function rawDeltaFromSr(S_r) {
  return rawDeltaFromTruthSignal(S_r);
}

function clampDelta(v) {
  return clampRawDelta(v);
}

export { computeRsPipeline, clampRawDelta, rawDeltaFromTruthSignal, computeTruthSignalFromComponents, blendIqFromRaw };

async function countPriorNormalUpdates(userId, excludeRitualId) {
  const r = await pool.query(
    `SELECT COUNT(DISTINCT ritual_id)::int AS c FROM rs_delta_history
     WHERE user_id = $1
       AND ritual_id != $2
       AND (bypass_reason IS NULL)
       AND (pipeline_kind IS NULL OR pipeline_kind IN ('lte3_normal', 'lte3_n_context_frozen'))`,
    [userId, excludeRitualId]
  );
  return r.rows[0]?.c ?? 0;
}

async function loadBc5Trend(userId, excludeRitualId) {
  const r = await pool.query(
    `SELECT s_r FROM (
       SELECT DISTINCT ON (ritual_id) s_r, created_at
       FROM rs_delta_history
       WHERE user_id = $1 AND ritual_id != $2 AND s_r IS NOT NULL
         AND (bypass_reason IS NULL)
       ORDER BY ritual_id, created_at DESC
     ) sub
     ORDER BY created_at DESC
     LIMIT 5`,
    [userId, excludeRitualId]
  );
  const vals = r.rows.map((x) => parseFloat(x.s_r)).filter((x) => Number.isFinite(x));
  if (vals.length === 0) return { trend: 0.5, n: 0 };
  const chronological = vals.reverse();
  const n = chronological.length;
  const slice = BC5_WEIGHTS.slice(-n);
  const sumW = slice.reduce((a, b) => a + b, 0);
  let trend = 0;
  for (let i = 0; i < n; i++) {
    trend += (slice[i] / sumW) * chronological[i];
  }
  return { trend, n };
}

export async function updateRSForRitual(ritualId, userId) {
  const userQuery = await pool.query('SELECT rs_score, solo_ceiling_lifted FROM users WHERE id = $1', [userId]);
  if (userQuery.rows.length === 0) throw new Error('User not found');

  let attRow;
  try {
    attRow = await pool.query(
      `SELECT status, positive_rs_voided FROM ritual_attendance WHERE ritual_id = $1 AND user_id = $2`,
      [ritualId, userId]
    );
  } catch (_e) {
    attRow = await pool.query(
      `SELECT status FROM ritual_attendance WHERE ritual_id = $1 AND user_id = $2`,
      [ritualId, userId]
    );
  }
  if (attRow.rows.length === 0) {
    return { skipped: true, reason: 'no_attendance' };
  }
  const st = attRow.rows[0].status;
  if (st === 'no_show' || st === 'cancelled') {
    return { skipped: true, reason: st };
  }

  const currentRS = parseFloat(userQuery.rows[0].rs_score) || RS_CONSTANTS.INIT;
  const completedBefore = await countPriorNormalUpdates(userId, ritualId);
  const ritualIndex = completedBefore + 1;
  const ritualRow = await pool.query('SELECT title FROM rituals WHERE id = $1', [ritualId]);
  const ritualTitle = ritualRow.rows[0]?.title || 'Ritual';

  const ts = await calculateTruthSignal(ritualId, userId, completedBefore);
  if (!ts) {
    return { skipped: true, reason: 'truth_signal_null' };
  }

  const { S_r } = ts;
  const deltaRaw = rawDeltaFromSr(S_r);
  const deltaCap = clampDelta(deltaRaw);

  try {
    await updateDsForUser(userId, ritualId);
  } catch (e) {
    console.warn('DS sync before RS failed:', e.message);
  }

  const ds = await getDiversityMultiplierFromState(userId, ritualIndex);

  const nCtx = await calculateNContextScore(userId, ritualId);
  let nFrozen = false;
  let pipelineInput = {
    S_r,
    currentRS,
    ritualIndex,
    dsMultiplier: ds.multiplier,
    bcTrend: 0.5,
    nFrozen: false,
  };

  if (ritualIndex >= LOCAL_CONFIG.rs.BC.MIN_RITUALS) {
    const bt = await loadBc5Trend(userId, ritualId);
    pipelineInput.bcTrend = bt.trend;
  }

  let pipeline = computeRsPipeline(pipelineInput);

  if (shouldFreezePositiveDelta(nCtx, pipeline.deltaAfterDs)) {
    nFrozen = true;
    pipeline = computeRsPipeline({ ...pipelineInput, nFrozen: true });
  }

  const {
    deltaAfterDs: delta1,
    deltaAfterBc: delta2,
    deltaAfterMd: delta3,
    deltaAfterBr: delta4,
    deltaFinal,
    bcMult: bc5Mult,
    mdMult: md,
    brMult: br,
    dsMult,
  } = pipeline;

  const bcTrend = pipelineInput.bcTrend;
  const answeredPeers = Number(ts.iqMeta?.n || 0);
  const noPeerPath = ts.iqMeta?.iq_null === true || answeredPeers <= 0;
  const hasR1 = !!ts.cfMeta?.hasR1;
  const hasMemory = Number(ts.M_r) > 0;
  const hasRq = !!ts.hasRq;
  const dampener = LOCAL_CONFIG.rs.no_peer.NO_PEER_DAMPENER;
  const ceiling = LOCAL_CONFIG.rs.no_peer.NO_PEER_CEILING;
  let noPeerDelta = deltaFinal;
  if (noPeerPath && noPeerDelta > 0) {
    noPeerDelta *= dampener;
  }
  const deltaBeforeEngagement = noPeerDelta;
  noPeerDelta = applyNoPeerEngagementGate(noPeerDelta, {
    noPeerPath,
    hasR1,
    hasMemory,
    hasRq,
  });
  const engagementBlocked =
    noPeerPath &&
    deltaBeforeEngagement > 0 &&
    noPeerDelta === 0 &&
    !(hasR1 || hasMemory || hasRq);
  const ceilingApplied = noPeerPath && !userQuery.rows[0].solo_ceiling_lifted;

  if (answeredPeers > 0 && !userQuery.rows[0].solo_ceiling_lifted) {
    await pool.query(
      `UPDATE users SET solo_ceiling_lifted = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [userId]
    );
  }

  noPeerDelta = applyFarToDelta(noPeerDelta);

  if (attRow.rows[0]?.positive_rs_voided && noPeerDelta > 0) {
    noPeerDelta = 0;
  }

  const dayCapIn = noPeerDelta;
  let dayUsedToday = 0;
  if (noPeerDelta > 0) {
    const todayPos = await pool.query(
      `SELECT COALESCE(SUM(delta), 0)::float AS s
       FROM rs_delta_history
       WHERE user_id = $1
         AND delta > 0
         AND created_at::date = CURRENT_DATE
         AND (bypass_reason IS NULL)`,
      [userId]
    );
    dayUsedToday = Number(todayPos.rows[0]?.s || 0);
    noPeerDelta = clampDayPositiveDelta(noPeerDelta, dayUsedToday);
  }
  const dayCap = {
    delta_in: dayCapIn,
    delta_out: noPeerDelta,
    used_today: dayUsedToday,
  };

  let newRS = Math.max(
    RS_CONSTANTS.MIN,
    Math.min(RS_CONSTANTS.MAX, currentRS + noPeerDelta)
  );
  if (ceilingApplied) newRS = Math.min(ceiling, newRS);
  const appliedDelta = newRS - currentRS;

  await pool.query(
    'UPDATE users SET rs_score = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
    [newRS, userId]
  );
  await redis.del(`rs_cache:${userId}`).catch(() => {});
  await redis.set(
    `rs_cache:${userId}`,
    JSON.stringify({ user_id: userId, rs_score: newRS, updated_at: new Date().toISOString() }),
    { EX: 24 * 60 * 60 }
  ).catch(() => {});

  const pipelineKind = nFrozen ? 'lte3_n_context_frozen' : 'lte3_normal';

  try {
    await pool.query(
      `INSERT INTO rs_history (user_id, old_rs, new_rs, source, ritual_id)
       VALUES ($1, $2, $3, 'ritual', $4)`,
      [userId, currentRS, newRS, ritualId]
    );
  } catch (e) {
    if (e.code !== '42P01') console.error('rs_history insert failed:', e.message);
  }

  try {
    await pool.query(
      `INSERT INTO rs_delta_history (
        user_id, ritual_id, delta, delta_before_bc3, old_rs, new_rs,
        s_r, delta_cap, ds_mult, n_context_frozen, bc5_trend, bc5_mult, md_mult, br_mult,
        delta_after_ds, pipeline_kind
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [
        userId,
        ritualId,
        appliedDelta,
        deltaCap,
        currentRS,
        newRS,
        S_r,
        deltaCap,
        dsMult,
        nFrozen,
        bcTrend,
        bc5Mult,
        md,
        br,
        delta1,
        pipelineKind,
      ]
    );
  } catch (e) {
    console.error('rs_delta_history insert failed:', e.message);
  }

  await logRsPipelineScoreEvents({
    userId,
    ritualId,
    ritualIndex,
    iqMeta: ts.iqMeta,
    pipeline,
    dayCap,
  });

  await logScoreEvent({
    userId,
    ritualId,
    eventType: 'rs_ritual',
    delta: appliedDelta,
    inputs: { s_r: S_r, current_rs: currentRS, ritual_index: ritualIndex, n_frozen: nFrozen, no_peer_path: noPeerPath, solo_path: noPeerPath },
    breakdown: {
      delta_raw: pipeline.deltaRaw,
      delta_after_ds: delta1,
      delta_after_bc: delta2,
      delta_after_md: delta3,
      delta_after_br: delta4,
      ds_mult: dsMult,
      bc_mult: bc5Mult,
      md_mult: md,
      br_mult: br,
      solo_dampener: noPeerPath ? dampener : 1,
      no_peer_dampener: noPeerPath ? dampener : 1,
      ceiling_applied: ceilingApplied,
      engagement_blocked: engagementBlocked,
      has_r1: hasR1,
      has_memory: hasMemory,
      has_rq: hasRq,
      iq_null: !!ts.iqMeta?.iq_null,
      far_phase: LOCAL_CONFIG.rs.far?.PHASE ?? 0,
      pipeline_kind: pipelineKind,
    },
  });

  try {
    await pool.query(
      `INSERT INTO rs_transactions (
         user_id, ritual_id, delta, rs_before, rs_after, transaction_type,
         component_a, component_iq, component_cf, component_m,
         if_penalty, ds_mult, n_context_score, n_context_frozen,
         bc5_trend, bc5_mult, md_mult, br_mult, rater_count
       ) VALUES (
         $1, $2, $3, $4, $5, 'ritual',
         $6, $7, $8, $9,
         $10, $11, $12, $13,
         $14, $15, $16, $17, $18
       )`,
      [
        userId,
        ritualId,
        appliedDelta,
        currentRS,
        newRS,
        ts.A_r,
        ts.IQ_r,
        ts.CF_r,
        ts.M_r,
        ts.IF_r,
        dsMult,
        nCtx,
        nFrozen,
        bcTrend,
        bc5Mult,
        md,
        br,
        ts.iqMeta?.n || 0,
      ]
    );
  } catch (e) {
    if (e.code !== '42P01') {
      console.error('rs_transactions insert failed:', e.message);
    }
  }

  let evaluatorCount = 0;
  try {
    const evaluatorResult = await pool.query(
      `SELECT COUNT(DISTINCT from_user_id)::int AS c
       FROM feedback
       WHERE ritual_id = $1
         AND to_user_id = $2`,
      [ritualId, userId]
    );
    evaluatorCount = evaluatorResult.rows[0]?.c || 0;
  } catch (_e) {
    evaluatorCount = 0;
  }

  // §9 FAR-0 + placement: RS kimseye (kendine bile) görünmez — değişim bildirimi yok
  let ownerMaySeeRs = farPhase() >= 1;
  if (ownerMaySeeRs) {
    try {
      const placement = await getPlacementCompleteMap([userId]);
      ownerMaySeeRs = placement.get(String(userId)) === true;
    } catch (_e) {
      ownerMaySeeRs = false;
    }
  }
  if (ownerMaySeeRs) {
    await notifyRSChange(userId, {
      ritual_id: ritualId,
      ritual_title: ritualTitle,
      delta: `${appliedDelta >= 0 ? '+' : ''}${Number(appliedDelta).toFixed(2).replace('.', ',')}`,
      evaluator_count: evaluatorCount,
    }).catch(() => {});
  }

  if ([5, 10, 20, 30].includes(ritualIndex)) {
    await notifyMaturationUpgrade(userId, {
      ritual_id: ritualId,
      ritual_title: ritualTitle,
      ritual_count_milestone: ritualIndex,
    }).catch(() => {});
  }

  return {
    oldRS: currentRS,
    newRS,
    delta: appliedDelta,
    deltaCap,
    S_r,
    dsMult,
    nContextScore: nCtx,
    nContextFrozen: nFrozen,
    bc5Multiplier: bc5Mult,
    bc5Trend: bcTrend,
    mdMultiplier: md,
    brMultiplier: br,
    noPeerPath,
    /** @deprecated use noPeerPath — ürün dili Solo Ritualist, kodda no_peer */
    soloPath: noPeerPath,
    ceilingApplied,
    engagementBlocked,
    ritualId,
    /** @deprecated use bc5Multiplier — alias for older scripts */
    bc3Multiplier: bc5Mult,
    /** @deprecated use deltaCap */
    deltaBeforeBC3: deltaCap,
  };
}

export async function updateRSForRitualParticipants(ritualId) {
  const participantsQuery = await pool.query(
    'SELECT DISTINCT user_id FROM ritual_attendance WHERE ritual_id = $1',
    [ritualId]
  );

  const updates = [];
  for (const row of participantsQuery.rows) {
    try {
      const result = await updateRSForRitual(ritualId, row.user_id);
      updates.push(result);
    } catch (error) {
      console.error(`Error updating RS for user ${row.user_id}:`, error);
    }
  }
  return updates;
}

export async function getRitualEnergyState(ritualId) {
  try {
    const q2Query = `
      SELECT q2_energy FROM feedback
      WHERE ritual_id = $1
        AND feedback_type IN ('p2p', 'p2host')
        AND q2_energy IS NOT NULL
    `;
    const result = await pool.query(q2Query, [ritualId]);
    if (result.rows.length === 0) {
      return { value: null, state: null };
    }
    const scores = result.rows.map((row) => normalizeAnswer(row.q2_energy));
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    let state;
    if (avg < 0.4) state = 'calm';
    else if (avg <= 0.7) state = 'mixed';
    else state = 'high';
    return { value: avg, state };
  } catch (error) {
    console.error('Error calculating ritual energy state:', error);
    return { value: null, state: null };
  }
}

export async function getRSCalculationDetails(ritualId, userId) {
  const completedBefore = await countPriorNormalUpdates(userId, ritualId);
  const ts = await calculateTruthSignal(ritualId, userId, completedBefore);
  if (!ts) {
    return { error: 'No valid attendance / skipped' };
  }
  const deltaRaw = rawDeltaFromSr(ts.S_r);
  const deltaCap = clampDelta(deltaRaw);
  return {
    attendance: ts.A_r,
    interactionQuality: ts.IQ_r,
    contextFit: ts.CF_r,
    memoryBonus: ts.M_r,
    integrityFriction: ts.IF_r,
    truthSignal: ts.S_r,
    deltaRaw,
    delta: deltaCap,
    iqMeta: ts.iqMeta,
  };
}
