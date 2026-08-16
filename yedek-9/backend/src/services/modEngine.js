/**
 * v2 §5 MOD-ENGINE — rapor paketi, L-merdiveni, host-witness, CSAM stub, itiraz.
 * Ham rapor RS'e dokunmaz; RS yalnız applyModAction (MOD-BYPASS) ile değişir.
 */
import pool from '../config/database.js';
import LOCAL_CONFIG from '../config/localConfig.js';
import { blacklistIdentityForUser } from './identityService.js';
import { evaluateGpsEdgeZeroMemoryPattern } from './checkinService.js';
import { runCsamScan, isCsamHoldStatus } from './csamScanner.js';

const LEVELS = new Set(['L0', 'L1', 'L2a', 'L2b', 'L3', 'L4']);
const EXTREME_KEYS = new Set([
  'report_cat_csam',
  'report_cat_sexual_assault',
  'extreme_csam',
  'extreme_assault',
]);

const TARGET_TYPES = new Set([
  'user',
  'friend',
  'friend_fl3',
  'memory',
  'quote',
  'ritual',
  'spark',
  'prelobby_message',
  'forum',
  'share2person',
  'venue_profile',
  'venue',
  'zone_profile',
  'zone',
  'venue_badge',
  'venue_event',
]);

function normalizeTargetType(targetType) {
  const t = String(targetType || '');
  if (t === 'share') return 'share2person';
  if (t === 'message') return 'prelobby_message';
  if (t === 'friend_fl') return 'friend_fl3';
  if (t === 'friend_fl1_3') return 'friend_fl3';
  if (t === 'venueprofile') return 'venue_profile';
  if (t === 'zoneprofile') return 'zone_profile';
  if (t === 'event') return 'venue_event';
  return t;
}

function isFounderUser(userId) {
  const founderIds = (process.env.FOUNDER_USER_IDS || process.env.ADMIN_USER_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return Boolean(userId && founderIds.includes(String(userId)));
}

function hoursFromNow(h) {
  return new Date(Date.now() + Number(h) * 3600 * 1000);
}
function daysFromNow(d) {
  return new Date(Date.now() + Number(d) * 86400 * 1000);
}

function slaHoursFor({ targetType, categoryKey, queueLane }) {
  const sla = LOCAL_CONFIG.mod.SLA_H || { safety: 2, content: 12, general: 48 };
  if (queueLane === 'safety' || EXTREME_KEYS.has(categoryKey)) return sla.safety;
  if (['memory', 'quote', 'forum', 'spark'].includes(targetType) || queueLane === 'content') {
    return sla.content;
  }
  return sla.general;
}

const PUBLIC_SCAN_AUDIENCES = new Set(['CIRCLE', 'CITY', 'ALL', 'PULSE']);

/** Provider yoksa taranmamış public görsel → ops kuyruğuna inceleme (tek satır, idempotent). */
async function enqueuePublicMediaOpsReview({ memoryId, audience, meta }) {
  if (!memoryId) return null;
  const mem = await pool
    .query(`SELECT user_id, ritual_id FROM memories WHERE id = $1`, [memoryId])
    .catch(() => ({ rows: [] }));
  const ownerId = mem.rows[0]?.user_id || null;
  if (!ownerId) return null;

  const existing = await pool.query(
    `SELECT id FROM mod_reports
     WHERE target_type = 'memory' AND target_id = $1
       AND category_key = 'public_media_scan_pending'
       AND status IN ('queued', 'in_review')
     LIMIT 1`,
    [memoryId]
  );
  if (existing.rows.length > 0) return existing.rows[0].id;

  const report = await createReport({
    reporterId: ownerId,
    targetType: 'memory',
    targetId: memoryId,
    ritualId: mem.rows[0]?.ritual_id || null,
    categoryKey: 'public_media_scan_pending',
    description: `Public ${audience} görsel tarayıcısız yayınlandı — ops incelemesi`,
    packageData: { auto_scan: true, scan_pending: true, audience, scan_meta: meta },
    queueLane: 'ops',
  });
  return report?.id || null;
}

/**
 * Public görsel taraması. Scanner (webhook/Sightengine) varsa çağrılır.
 * Yoksa CIRCLE/CITY → pending_review + ops + hold (feed gizler).
 * WINDOW tarayıcı olmadan window_pass.
 */
export async function scanPublicMedia({
  contentUrl = null,
  memoryId = null,
  audience = 'CITY',
} = {}) {
  const aud = String(audience || 'CITY').toUpperCase();
  const isPublic = PUBLIC_SCAN_AUDIENCES.has(aud);
  const metaBase = {
    content_url: contentUrl || null,
    audience: aud,
    scanned_at: new Date().toISOString(),
  };

  if (!isPublic) {
    const result = {
      status: 'window_pass',
      flagged: false,
      provider: null,
      hold_public: false,
      meta: metaBase,
    };
    if (memoryId) {
      await pool
        .query(
          `UPDATE memories
           SET csam_scan_status = $2, csam_scan_at = NOW(), csam_scan_meta = $3::jsonb
           WHERE id = $1`,
          [memoryId, result.status, JSON.stringify({ ...metaBase, ...result })]
        )
        .catch(() => {});
    }
    return result;
  }

  const scanned = await runCsamScan({ contentUrl, memoryId, audience: aud });
  const meta = { ...metaBase, provider: scanned.provider, labels: scanned.labels || [] };

  let status = scanned.status || 'pending_review';
  if (scanned.flagged) status = 'flagged';
  else if (scanned.ok && !scanned.flagged && (status === 'provider_scanned' || status === 'clear')) {
    status = 'clear';
  } else if (!scanned.ok && status !== 'pending_review') {
    status = status === 'provider_error' ? 'provider_error' : 'pending_review';
  }

  const hold = scanned.hold_public !== false && isCsamHoldStatus(status);
  const result = {
    status,
    flagged: Boolean(scanned.flagged),
    labels: scanned.labels || [],
    confidence: scanned.confidence || 0,
    provider: scanned.provider,
    hold_public: hold,
    ops_review_enqueued: false,
    meta,
  };

  if (memoryId) {
    await pool
      .query(
        `UPDATE memories
         SET csam_scan_status = $2, csam_scan_at = NOW(), csam_scan_meta = $3::jsonb
         WHERE id = $1`,
        [memoryId, result.status, JSON.stringify(meta)]
      )
      .catch(() => {});

    if (result.flagged) {
      const mem = await pool
        .query(`SELECT user_id, ritual_id FROM memories WHERE id = $1`, [memoryId])
        .catch(() => ({ rows: [] }));
      const ownerId = mem.rows[0]?.user_id || null;
      const ritualId = mem.rows[0]?.ritual_id || null;
      if (ownerId) {
        await createReport({
          reporterId: ownerId,
          targetType: 'memory',
          targetId: memoryId,
          ritualId,
          categoryKey: 'report_cat_csam',
          description: 'Auto scan flagged public visual',
          packageData: { auto_scan: true, provider_result: result },
          queueLane: 'safety',
        }).catch(() => {});
      }
    } else if (hold) {
      const reportId = await enqueuePublicMediaOpsReview({
        memoryId,
        audience: aud,
        meta: { ...meta, provider_error: status === 'provider_error' },
      }).catch(() => null);
      result.ops_review_enqueued = Boolean(reportId);
      result.report_id = reportId;
    }
  }

  return result;
}

/**
 * Master Parametre §8 — sessiz-çıkış pattern: 2–3 / 30g inceleme tetği.
 * Kaynak: left_early_at + leave_after raporları (aynı ritüel tek sayılır).
 */
export async function evaluateSilentExitPattern(userId) {
  const cfg = LOCAL_CONFIG.mod.SILENT_EXIT || {};
  const windowDays = cfg.WINDOW_DAYS ?? 30;
  const minHits = cfg.MIN_HITS ?? 3;

  const r = await pool.query(
    `SELECT COUNT(*)::int AS c FROM (
       SELECT ra.ritual_id
       FROM ritual_attendance ra
       WHERE ra.user_id = $1
         AND ra.left_early_at IS NOT NULL
         AND ra.left_early_at >= NOW() - ($2::text || ' days')::interval
       UNION
       SELECT mr.ritual_id
       FROM mod_reports mr
       WHERE mr.reporter_id = $1
         AND mr.leave_after = true
         AND mr.ritual_id IS NOT NULL
         AND mr.created_at >= NOW() - ($2::text || ' days')::interval
     ) t`,
    [userId, String(windowDays)]
  );

  const hits = Number(r.rows[0]?.c || 0);
  return {
    hit: hits >= minHits,
    hits,
    threshold: minHits,
    window_days: windowDays,
  };
}

/**
 * Eşik aşılınca (ve açık kuyruk kaydı yoksa) inceleme raporu açar — RS'e dokunmaz.
 */
export async function maybeEnqueueSilentExitReview(userId, ritualId = null) {
  if (!userId) return null;
  const pat = await evaluateSilentExitPattern(userId);
  if (!pat.hit) return { enqueued: false, pattern: pat };

  const existing = await pool.query(
    `SELECT id FROM mod_reports
     WHERE target_id = $1
       AND category_key = 'silent_exit_pattern'
       AND status IN ('queued', 'in_review')
       AND created_at >= NOW() - ($2::text || ' days')::interval
     LIMIT 1`,
    [userId, String(pat.window_days)]
  );
  if (existing.rows.length > 0) {
    return { enqueued: false, already_open: true, pattern: pat, report_id: existing.rows[0].id };
  }

  const slaH = LOCAL_CONFIG.mod.SLA_H?.general ?? 48;
  const pkg = {
    pattern: pat,
    auto: true,
    factors: { silent_exit_pattern: LOCAL_CONFIG.mod.SILENT_EXIT?.FACTOR_WEIGHT ?? 0.15 },
    ai_suggestion: {
      level: 'L0',
      confidence: 0.5,
      rationale: `Sessiz-çıkış pattern: ${pat.hits}/${pat.threshold} · ${pat.window_days}g — inceleme tetği.`,
      auto_apply: false,
    },
  };

  const inserted = await pool.query(
    `INSERT INTO mod_reports
       (reporter_id, target_type, target_id, ritual_id, category_key, leave_after,
        package_json, correlation_score, ai_suggestion, queue_lane, sla_due_at, description, status)
     VALUES ($1,'user',$1,$2,'silent_exit_pattern',false,
             $3::jsonb,$4,$5::jsonb,'general',$6,$7,'queued')
     RETURNING *`,
    [
      userId,
      ritualId,
      JSON.stringify(pkg),
      Number(LOCAL_CONFIG.mod.SILENT_EXIT?.FACTOR_WEIGHT ?? 0.15),
      JSON.stringify(pkg.ai_suggestion),
      hoursFromNow(slaH),
      `Auto: silent-exit pattern ${pat.hits} hits / ${pat.window_days}d`,
    ]
  );

  return { enqueued: true, pattern: pat, report: inserted.rows[0] };
}

/**
 * sonMD §5 K4 — günlük leave MOD-eşiği. Otomatik ceza yok; desen dosyası.
 */
export async function maybeEnqueueDailyLeaveReview(userId, ritualId = null) {
  if (!userId) return null;
  const threshold = Number(LOCAL_CONFIG.modSignals?.DAILY_LEAVE_MOD_SIGNAL || 6);
  if (threshold <= 0) return { enqueued: false };

  const leaveCount = await pool.query(
    `SELECT COUNT(*)::int AS c
     FROM ritual_attendance
     WHERE user_id = $1
       AND left_early_at IS NOT NULL
       AND left_early_at::date = CURRENT_DATE`,
    [userId]
  );
  const hits = Number(leaveCount.rows[0]?.c || 0);
  if (hits < threshold) return { enqueued: false, hits, threshold };

  const existing = await pool.query(
    `SELECT id FROM mod_reports
     WHERE target_id = $1
       AND category_key = 'daily_leave_pattern'
       AND status IN ('queued', 'in_review')
       AND created_at::date = CURRENT_DATE
     LIMIT 1`,
    [userId]
  );
  if (existing.rows.length > 0) {
    return { enqueued: false, already_open: true, hits, threshold, report_id: existing.rows[0].id };
  }

  const slaH = LOCAL_CONFIG.mod.SLA_H?.general ?? 48;
  const pkg = {
    pattern: { key: 'daily_leave_pattern', hits, threshold, window: 'today' },
    auto: true,
    factors: { daily_leave_pattern: 0.1 },
    ai_suggestion: {
      level: 'L0',
      confidence: 0.4,
      rationale: `K4 günlük leave eşiği: ${hits}/${threshold} bugün — desen dosyası, otomatik ceza yok.`,
      auto_apply: false,
    },
  };

  const inserted = await pool.query(
    `INSERT INTO mod_reports
       (reporter_id, target_type, target_id, ritual_id, category_key, leave_after,
        package_json, correlation_score, ai_suggestion, queue_lane, sla_due_at, description, status)
     VALUES ($1,'user',$1,$2,'daily_leave_pattern',false,
             $3::jsonb,$4,$5::jsonb,'general',$6,$7,'queued')
     RETURNING *`,
    [
      userId,
      ritualId,
      JSON.stringify(pkg),
      0.1,
      JSON.stringify(pkg.ai_suggestion),
      hoursFromNow(slaH),
      `Auto: K4 daily leave ${hits}/${threshold} today`,
    ]
  );

  return { enqueued: true, hits, threshold, report: inserted.rows[0] };
}

/**
 * sonMD §3/C4 — yalancı-tanık deseni: eşik aşımı (saf kural, SQL’siz test).
 * hit = yeter sayıda şüpheli özne VEYA tekrarlayan tanık–özne çifti.
 */
export function falseWitnessPatternHit({
  suspectSubjects = 0,
  repeatPairs = 0,
  minSuspectSubjects = 3,
  minPairRepeats = 1,
} = {}) {
  return (
    Number(suspectSubjects) >= Number(minSuspectSubjects) ||
    Number(repeatPairs) >= Number(minPairRepeats)
  );
}

function falseWitnessSuspectSql() {
  const edge = LOCAL_CONFIG.checkin?.GPS_EDGE || {};
  const margin = Number(edge.MARGIN_M ?? 5);
  const ratioMin = Number(edge.RATIO_MIN ?? 0.9);
  return {
    margin,
    ratioMin,
    clause: `(
      ra.location_suspect = true
      OR (
        ra.gps_distance_m IS NOT NULL
        AND ra.checkin_radius_m IS NOT NULL
        AND ra.checkin_radius_m > 0
        AND (
          ra.gps_distance_m >= GREATEST(0, ra.checkin_radius_m - $3)
          OR (ra.gps_distance_m / ra.checkin_radius_m) >= $4
        )
      )
    )`,
  };
}

/**
 * sonMD §3/C4 — hep-aynı-tanık + T2/sınır kombinasyonu.
 * Hedef = tanık (yalancı-tanık sicili); RS'e dokunmaz.
 */
export async function evaluateFalseWitnessPattern(userId) {
  const cfg = LOCAL_CONFIG.witness?.FALSE_WITNESS || {};
  const windowDays = cfg.WINDOW_DAYS ?? 30;
  const minSuspectSubjects = cfg.MIN_SUSPECT_SUBJECTS ?? 3;
  const minPairRepeats = cfg.MIN_PAIR_REPEATS ?? 2;
  const { margin, ratioMin, clause } = falseWitnessSuspectSql();

  const subjects = await pool.query(
    `SELECT COUNT(DISTINCT w.subject_user_id)::int AS c
     FROM ritual_checkin_witnesses w
     JOIN ritual_attendance ra
       ON ra.ritual_id = w.ritual_id AND ra.user_id = w.subject_user_id
     WHERE w.witness_user_id = $1
       AND w.created_at >= NOW() - ($2::text || ' days')::interval
       AND ${clause}`,
    [userId, String(windowDays), margin, ratioMin]
  );

  const pairs = await pool.query(
    `SELECT COUNT(*)::int AS c FROM (
       SELECT w.subject_user_id
       FROM ritual_checkin_witnesses w
       JOIN ritual_attendance ra
         ON ra.ritual_id = w.ritual_id AND ra.user_id = w.subject_user_id
       WHERE w.witness_user_id = $1
         AND w.created_at >= NOW() - ($2::text || ' days')::interval
         AND ${clause}
       GROUP BY w.subject_user_id
       HAVING COUNT(DISTINCT w.ritual_id) >= $5
     ) t`,
    [userId, String(windowDays), margin, ratioMin, minPairRepeats]
  );

  const suspectSubjects = Number(subjects.rows[0]?.c || 0);
  const repeatPairs = Number(pairs.rows[0]?.c || 0);
  return {
    hit: falseWitnessPatternHit({
      suspectSubjects,
      repeatPairs,
      minSuspectSubjects,
      minPairRepeats: 1,
    }),
    suspect_subjects: suspectSubjects,
    repeat_pairs: repeatPairs,
    threshold_subjects: minSuspectSubjects,
    min_pair_repeats: minPairRepeats,
    window_days: windowDays,
  };
}

/**
 * Eşik aşılınca inceleme raporu — L0, auto_apply yok (C4: desen→L-merdiveni insan).
 */
export async function maybeEnqueueFalseWitnessReview(userId, ritualId = null) {
  if (!userId) return null;
  let pat;
  try {
    pat = await evaluateFalseWitnessPattern(userId);
  } catch (_e) {
    return { enqueued: false, error: 'evaluate_failed' };
  }
  if (!pat.hit) return { enqueued: false, pattern: pat };

  const existing = await pool.query(
    `SELECT id FROM mod_reports
     WHERE target_id = $1
       AND category_key = 'false_witness'
       AND status IN ('queued', 'in_review')
       AND created_at >= NOW() - ($2::text || ' days')::interval
     LIMIT 1`,
    [userId, String(pat.window_days)]
  );
  if (existing.rows.length > 0) {
    return { enqueued: false, already_open: true, pattern: pat, report_id: existing.rows[0].id };
  }

  const slaH = LOCAL_CONFIG.mod.SLA_H?.general ?? 48;
  const weight = Number(LOCAL_CONFIG.witness?.FALSE_WITNESS?.FACTOR_WEIGHT ?? 0.2);
  const pkg = {
    pattern: pat,
    auto: true,
    factors: { false_witness: weight },
    ai_suggestion: {
      level: 'L0',
      confidence: 0.55,
      rationale: `Yalancı-tanık deseni: ${pat.suspect_subjects} şüpheli özne / ${pat.repeat_pairs} tekrar çift · ${pat.window_days}g — insan incelemesi.`,
      auto_apply: false,
    },
  };

  const inserted = await pool.query(
    `INSERT INTO mod_reports
       (reporter_id, target_type, target_id, ritual_id, category_key, leave_after,
        package_json, correlation_score, ai_suggestion, queue_lane, sla_due_at, description, status)
     VALUES ($1,'user',$1,$2,'false_witness',false,
             $3::jsonb,$4,$5::jsonb,'ops',$6,$7,'queued')
     RETURNING *`,
    [
      userId,
      ritualId,
      JSON.stringify(pkg),
      weight,
      JSON.stringify(pkg.ai_suggestion),
      hoursFromNow(slaH),
      `Auto: false-witness pattern ${pat.suspect_subjects} subjects / ${pat.repeat_pairs} repeat pairs / ${pat.window_days}d`,
    ]
  );

  try {
    const { recordCheckinFunnelEvent } = await import('./checkinFunnelService.js');
    await recordCheckinFunnelEvent({
      ritualId,
      userId,
      event: 'false_witness_flag',
      meta: pat,
    });
  } catch (_e) {
    /* non-fatal */
  }

  return { enqueued: true, pattern: pat, report: inserted.rows[0] };
}

/**
 * sonMD §3: onaylanmamış pending + kapı kapandı → no-show değil;
 * "doğrulanamamış check-in" MOD dosyası (insan kararı).
 */
export async function enqueueUnverifiedCheckinReview(userId, ritualId = null, meta = {}) {
  if (!userId) return null;
  const existing = await pool.query(
    `SELECT id FROM mod_reports
     WHERE target_id = $1
       AND category_key = 'unverified_checkin'
       AND ($2::uuid IS NULL OR ritual_id = $2)
       AND status IN ('queued', 'in_review')
     LIMIT 1`,
    [userId, ritualId]
  );
  if (existing.rows.length > 0) {
    return { enqueued: false, already_open: true, report_id: existing.rows[0].id };
  }

  const slaH = LOCAL_CONFIG.mod.SLA_H?.general ?? 48;
  const pkg = {
    auto: true,
    meta,
    factors: { unverified_checkin: 0.2 },
    ai_suggestion: {
      level: 'L0',
      confidence: 0.55,
      rationale: 'Doğrulanamamış check-in — pending tanık onaysız kaldı; otomatik no-show yok, insan kararı.',
      auto_apply: false,
    },
  };

  const inserted = await pool.query(
    `INSERT INTO mod_reports
       (reporter_id, target_type, target_id, ritual_id, category_key, leave_after,
        package_json, correlation_score, ai_suggestion, queue_lane, sla_due_at, description, status)
     VALUES ($1,'user',$1,$2,'unverified_checkin',false,
             $3::jsonb,$4,$5::jsonb,'ops',$6,$7,'queued')
     RETURNING *`,
    [
      userId,
      ritualId,
      JSON.stringify(pkg),
      0.2,
      JSON.stringify(pkg.ai_suggestion),
      hoursFromNow(slaH),
      `Auto: unverified check-in (pending witness unresolved)`,
    ]
  );
  return { enqueued: true, report: inserted.rows[0] };
}

export async function buildReportPackage({
  reporterId,
  targetId,
  categoryKey,
  ritualId,
  targetType,
}) {
  const factors = {
    second_independent_report: 0,
    silent_exit_sync: 0,
    silent_exit_pattern: 0,
    mass_early_leave: 0,
    target_record: 0,
    reporter_reliability: 0.7,
    coordination_suspicion: 0,
    bait_chip_density: 0,
    gps_edge_zero_memory: 0,
    false_witness_pattern: 0,
  };

  if (targetId && ritualId) {
    const indep = await pool.query(
      `SELECT COUNT(DISTINCT reporter_id)::int AS c
       FROM mod_reports
       WHERE ritual_id = $1 AND target_id = $2 AND reporter_id <> $3
         AND created_at >= NOW() - INTERVAL '24 hours'`,
      [ritualId, targetId, reporterId]
    );
    factors.second_independent_report = Number(indep.rows[0]?.c || 0) >= 1 ? 0.35 : 0;
  }

  if (ritualId) {
    const early = await pool.query(
      `SELECT COUNT(*)::int AS c FROM ritual_attendance
       WHERE ritual_id = $1 AND left_early_at IS NOT NULL
         AND left_early_at >= NOW() - INTERVAL '2 hours'`,
      [ritualId]
    );
    const c = Number(early.rows[0]?.c || 0);
    factors.mass_early_leave = Math.min(0.25, c * 0.05);

    // Sessiz/cezasız çıkış kümesi (leave_after raporları + left_early_at 15dk Window)
    const silent = await pool.query(
      `SELECT COUNT(*)::int AS c FROM (
         SELECT left_early_at AS ts FROM ritual_attendance
         WHERE ritual_id = $1 AND left_early_at IS NOT NULL
           AND left_early_at >= NOW() - INTERVAL '2 hours'
         UNION ALL
         SELECT created_at AS ts FROM mod_reports
         WHERE ritual_id = $1 AND leave_after = true
           AND created_at >= NOW() - INTERVAL '2 hours'
       ) t`,
      [ritualId]
    );
    const silentC = Number(silent.rows[0]?.c || 0);
    const clustered = await pool.query(
      `SELECT COUNT(*)::int AS c FROM ritual_attendance a
       WHERE a.ritual_id = $1 AND a.left_early_at IS NOT NULL
         AND EXISTS (
           SELECT 1 FROM ritual_attendance b
           WHERE b.ritual_id = a.ritual_id AND b.user_id <> a.user_id
             AND b.left_early_at IS NOT NULL
             AND ABS(EXTRACT(EPOCH FROM (b.left_early_at - a.left_early_at))) <= 900
         )`,
      [ritualId]
    ).catch(() => ({ rows: [{ c: 0 }] }));
    factors.silent_exit_sync =
      silentC >= 2 || Number(clustered.rows[0]?.c || 0) >= 2 ? 0.15 : 0;
  }

  if (targetId) {
    const record = await pool.query(
      `SELECT COUNT(*)::int AS c FROM mod_actions
       WHERE target_user_id = $1 AND created_at >= NOW() - INTERVAL '180 days'`,
      [targetId]
    );
    factors.target_record = Math.min(0.25, Number(record.rows[0]?.c || 0) * 0.05);

    // Master Parametre §2 — hep radius sınırı + sıfır memory
    try {
      const edgePat = await evaluateGpsEdgeZeroMemoryPattern(targetId);
      if (edgePat.hit) {
        factors.gps_edge_zero_memory = Number(LOCAL_CONFIG.checkin.GPS_EDGE?.FACTOR_WEIGHT ?? 0.15);
      }
    } catch {
      /* column may be absent pre-migration — ignore */
    }

    // Master Parametre §8 — sessiz-çıkış 2–3 / 30g
    try {
      const silentPat = await evaluateSilentExitPattern(targetId);
      if (silentPat.hit) {
        factors.silent_exit_pattern = Number(LOCAL_CONFIG.mod.SILENT_EXIT?.FACTOR_WEIGHT ?? 0.15);
      }
    } catch {
      /* ignore */
    }

    try {
      const fwPat = await evaluateFalseWitnessPattern(targetId);
      if (fwPat.hit) {
        factors.false_witness_pattern = Number(
          LOCAL_CONFIG.witness?.FALSE_WITNESS?.FACTOR_WEIGHT ?? 0.2
        );
      }
    } catch {
      /* ignore */
    }
  }

  if (reporterId) {
    const falseish = await pool.query(
      `SELECT COUNT(*)::int AS c FROM mod_actions ma
       JOIN mod_reports mr ON mr.id = ma.report_id
       WHERE mr.reporter_id = $1 AND ma.level IN ('L1','L2a')
         AND ma.note ILIKE '%false%'
         AND ma.created_at >= NOW() - INTERVAL '180 days'`,
      [reporterId]
    );
    const warn = await pool.query(`SELECT COALESCE(mod_warning_count,0)::int AS c FROM users WHERE id = $1`, [
      reporterId,
    ]);
    const hits = Number(falseish.rows[0]?.c || 0) + Number(warn.rows[0]?.c || 0);
    factors.reporter_reliability = Math.max(0.35, 1 - hits * 0.15);
  }

  if (ritualId && reporterId) {
    const coord = await pool.query(
      `SELECT COUNT(*)::int AS c FROM mod_reports
       WHERE ritual_id = $1 AND reporter_id = $2
         AND created_at >= NOW() - INTERVAL '1 hour'`,
      [ritualId, reporterId]
    );
    factors.coordination_suspicion = Number(coord.rows[0]?.c || 0) >= 3 ? 0.2 : 0;
  }

  if (ritualId && categoryKey === 'report_cat_mismatch') {
    const bait = await pool.query(
      `SELECT COUNT(*)::int AS c FROM feedback
       WHERE ritual_id = $1
         AND (chip_id ILIKE '%yanilt%' OR chip_route ILIKE '%bait%' OR chip_id ILIKE '%mismatch%')`,
      [ritualId]
    ).catch(() => ({ rows: [{ c: 0 }] }));
    factors.bait_chip_density = Math.min(0.2, Number(bait.rows[0]?.c || 0) * 0.05);
  }

  const raw =
    factors.second_independent_report +
    factors.silent_exit_sync +
    factors.silent_exit_pattern +
    factors.mass_early_leave +
    factors.target_record +
    factors.bait_chip_density +
    factors.gps_edge_zero_memory +
    factors.false_witness_pattern +
    factors.reporter_reliability * 0.15 -
    factors.coordination_suspicion;
  const correlation_score = Math.max(0, Math.min(1, Number(raw.toFixed(3))));

  const extreme = EXTREME_KEYS.has(categoryKey);
  let suggested = 'L0';
  let confidence = 0.4;
  let rationale = 'Düşük korelasyon; içerik incelemesi önerilir.';
  let priorL2a = false;
  if (targetId) {
    const prior = await pool.query(
      `SELECT 1 FROM mod_actions
       WHERE target_user_id = $1 AND level IN ('L2a','L2')
         AND created_at >= NOW() - INTERVAL '30 days'
       LIMIT 1`,
      [targetId]
    );
    priorL2a = prior.rows.length > 0;
  }
  if (extreme) {
    suggested = 'L4';
    confidence = 0.85;
    rationale = 'Extreme kategori — L3 atlanır, doğrudan L4 insan onayı gerekir.';
  } else if (priorL2a && correlation_score >= 0.45) {
    suggested = 'L2b';
    confidence = 0.7;
    rationale = '30g içinde L2a tekrarı — L2b (7g host ban + 30g free-location yasağı) önerilir.';
  } else if (correlation_score >= 0.75) {
    suggested = 'L2a';
    confidence = 0.62;
    rationale = 'Yüksek paket korelasyonu; L2a dört göz onayı önerilir.';
  } else if (correlation_score >= Number(LOCAL_CONFIG.mod.L1_PACKET_MIN || 2) * 0.2) {
    suggested = 'L1';
    confidence = 0.55;
    rationale = 'Orta korelasyon; resmi uyarı eşiği.';
  }

  // L3+ ASLA otomatik — öneri yalnızca bilgilendirme
  const ai_suggestion = {
    level: suggested,
    confidence,
    rationale,
    auto_apply: false,
    never_auto_above: 'L2a',
    prior_l2a_30d: priorL2a,
  };

  return { correlation_score, factors, ai_suggestion, extreme, target_type: targetType, prior_l2a_30d: priorL2a };
}

export async function correlationScore(args) {
  const pkg = await buildReportPackage(args);
  return pkg.correlation_score;
}

async function createHostWitness({ reportId, ritualId, targetId }) {
  if (!ritualId || !reportId) return null;
  const ritual = await pool.query(`SELECT host_id, venue_id FROM rituals WHERE id = $1`, [ritualId]);
  if (!ritual.rows.length) return null;
  const hostId = ritual.rows[0].host_id;
  const venueId = ritual.rows[0].venue_id;
  const created = [];

  if (!(targetId && String(hostId) === String(targetId))) {
    const existing = await pool.query(
      `SELECT id FROM mod_host_witness WHERE report_id = $1 AND host_id = $2 LIMIT 1`,
      [reportId, hostId]
    );
    if (!existing.rows.length) {
      const row = await pool.query(
        `INSERT INTO mod_host_witness (report_id, host_id) VALUES ($1, $2) RETURNING *`,
        [reportId, hostId]
      );
      created.push(row.rows[0]);
    }
  }

  // Venue Rituali → venue owner/manager de tanık olabilir
  if (venueId) {
    const owners = await pool.query(
      `SELECT DISTINCT u.id
       FROM venues v
       LEFT JOIN venue_managers vm ON vm.venue_id = v.id
       LEFT JOIN users u ON u.id = COALESCE(v.owner_user_id, vm.user_id)
       WHERE v.id = $1 AND u.id IS NOT NULL
         AND ($2::uuid IS NULL OR u.id <> $2)`,
      [venueId, targetId]
    ).catch(() => ({ rows: [] }));
    for (const o of owners.rows) {
      if (String(o.id) === String(hostId)) continue;
      const existing = await pool.query(
        `SELECT id FROM mod_host_witness WHERE report_id = $1 AND host_id = $2 LIMIT 1`,
        [reportId, o.id]
      );
      if (existing.rows.length) continue;
      const row = await pool.query(
        `INSERT INTO mod_host_witness (report_id, host_id) VALUES ($1, $2) RETURNING *`,
        [reportId, o.id]
      );
      created.push(row.rows[0]);
    }
  }

  return created[0] || null;
}

export async function answerHostWitness({ reportId, hostId, answer }) {
  const allowed = new Set(['yes_issue', 'no_issue', 'unsure']);
  if (!allowed.has(answer)) throw new Error('Invalid witness answer');
  const r = await pool.query(
    `UPDATE mod_host_witness
     SET answer = $3, answered_at = NOW()
     WHERE report_id = $1 AND host_id = $2
     RETURNING *`,
    [reportId, hostId, answer]
  );
  if (!r.rows.length) throw new Error('Host witness not found');
  return r.rows[0];
}

export async function createReport({
  reporterId,
  targetType,
  targetId = null,
  ritualId = null,
  categoryKey = null,
  leaveAfter = false,
  description = null,
  packageData = {},
  queueLane = null,
}) {
  targetType = normalizeTargetType(targetType);
  if (!TARGET_TYPES.has(String(targetType))) {
    throw new Error(`Invalid target_type: ${targetType}`);
  }
  const lane =
    queueLane ||
    (EXTREME_KEYS.has(categoryKey) ? 'safety' : targetType === 'zone' ? 'ops' : 'general');
  // zone → dual queue: also mirror ops lane flag inside package
  const pkg = await buildReportPackage({
    reporterId,
    targetId,
    categoryKey,
    ritualId,
    targetType,
  });
  const merged = {
    ...pkg,
    ...packageData,
    dual_queue: targetType === 'zone' ? ['moderation', 'ops'] : ['moderation'],
  };
  const slaH = slaHoursFor({ targetType, categoryKey, queueLane: lane === 'ops' ? 'ops' : lane });
  const slaDue = hoursFromNow(slaH);

  const insertOne = async (queueLaneValue) => {
    const result = await pool.query(
      `INSERT INTO mod_reports
         (reporter_id, target_type, target_id, ritual_id, category_key, leave_after,
          package_json, correlation_score, ai_suggestion, queue_lane, sla_due_at, description, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9::jsonb,$10,$11,$12,'queued')
       RETURNING *`,
      [
        reporterId,
        targetType,
        targetId,
        ritualId,
        categoryKey,
        Boolean(leaveAfter),
        JSON.stringify(merged),
        pkg.correlation_score,
        JSON.stringify(pkg.ai_suggestion),
        queueLaneValue,
        slaDue,
        description,
      ]
    );
    return result.rows[0];
  };

  // Zone: moderasyon + OPS çift kuyruk (iki satır)
  const report = await insertOne(targetType === 'zone' ? 'general' : lane);
  if (targetType === 'zone') {
    await insertOne('ops');
  }

  // Window-içi / Ritual raporu → host-witness (host hedef değilse)
  if (ritualId) {
    await createHostWitness({ reportId: report.id, ritualId, targetId }).catch(() => null);
  }

  // Bildir ve ayrıl: cezasız çıkış + FB veremez bayrağı leave_after'ta
  if (leaveAfter && ritualId && reporterId) {
    const { cancelAttendancePenaltyFree } = await import('./penaltyService.js');
    await cancelAttendancePenaltyFree(ritualId, reporterId).catch(async () => {
      await pool.query(
        `UPDATE ritual_attendance
         SET left_early_at = COALESCE(left_early_at, NOW()), status = 'left_early'
         WHERE ritual_id = $1 AND user_id = $2`,
        [ritualId, reporterId]
      );
    });
    await maybeEnqueueSilentExitReview(reporterId, ritualId).catch(() => null);
  }

  // Extreme: kuyruğu safety'e al, otomatik aksiyon YOK
  if (pkg.extreme) {
    await pool.query(
      `UPDATE mod_reports SET queue_lane = 'safety', updated_at = NOW() WHERE id = $1`,
      [report.id]
    );
  }

  return report;
}

export async function hasActiveSanction(userId, kind) {
  const r = await pool.query(
    `SELECT 1 FROM mod_sanctions
     WHERE user_id = $1 AND kind = $2 AND active = true
       AND (ends_at IS NULL OR ends_at > NOW())
     LIMIT 1`,
    [userId, kind]
  );
  return r.rows.length > 0;
}

export async function isModSuspended(userId) {
  return (
    (await hasActiveSanction(userId, 'full_suspend')) ||
    (await hasActiveSanction(userId, 'permanent_ban'))
  );
}

export async function canHostRitualMod(userId) {
  if (await hasActiveSanction(userId, 'permanent_ban')) {
    return { ok: false, code: 'MOD_L4_BAN', message: 'Kalıcı ban — Ritual açılamaz.' };
  }
  if (await hasActiveSanction(userId, 'full_suspend')) {
    return { ok: false, code: 'MOD_L3_SUSPEND', message: 'Mod askısı aktif — Ritual açılamaz.' };
  }
  if (await hasActiveSanction(userId, 'ritual_host_ban')) {
    return { ok: false, code: 'MOD_L2_HOST_BAN', message: 'L2 Ritual açma yasağı aktif.' };
  }
  return { ok: true };
}

/** L2b free-location yasağı — custom pin ile Ritual açılamaz */
export async function canUseFreeLocation(userId) {
  if (await hasActiveSanction(userId, 'free_location_ban')) {
    return {
      ok: false,
      code: 'MOD_L2B_FREE_BAN',
      message: 'Free-location yasağı aktif — yalnız venue/zone kullan.',
    };
  }
  return { ok: true };
}

export async function canEarnBadges(userId) {
  return !(await isModSuspended(userId));
}

export async function reporterBlockedFromGivingFeedback(userId, ritualId) {
  const r = await pool.query(
    `SELECT 1 FROM mod_reports
     WHERE reporter_id = $1 AND ritual_id = $2 AND leave_after = true
     LIMIT 1`,
    [userId, ritualId]
  );
  return r.rows.length > 0;
}

async function insertSanction({ userId, level, kind, endsAt, actionId, meta = {} }) {
  await pool.query(
    `INSERT INTO mod_sanctions (user_id, level, kind, ends_at, action_id, meta)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
    [userId, level, kind, endsAt, actionId, JSON.stringify(meta)]
  );
}

/**
 * MOD-BYPASS: RS'e dokunan tek yol. L3+ çift moderatör + founder.
 * L3+ asla otomatik çağrılmaz (API admin only).
 */
export async function applyModAction({
  reportId,
  level,
  targetUserId,
  moderatorId,
  secondModeratorId = null,
  founderApproved = false,
  founderUserId = null,
  note = null,
  contentAction = null,
  rsDeltaOverride = null,
  forceBelowThreshold = false,
}) {
  if (!LEVELS.has(level)) throw new Error('Invalid moderation level');
  if (!targetUserId && !['L0'].includes(level)) throw new Error('targetUserId is required');

  if (['L2a', 'L2b'].includes(level)) {
    const okFourEyes =
      (moderatorId && secondModeratorId && moderatorId !== secondModeratorId) ||
      (moderatorId && founderApproved && isFounderUser(founderUserId || moderatorId));
    if (!okFourEyes) {
      throw new Error('L2 four-eyes: two distinct moderators or founder approval required');
    }
    if (founderApproved && !isFounderUser(founderUserId || moderatorId)) {
      throw new Error('Founder approval requires FOUNDER_USER_IDS (or ADMIN_USER_IDS) membership');
    }
  }
  if (['L3', 'L4'].includes(level)) {
    if (!moderatorId || !secondModeratorId || moderatorId === secondModeratorId) {
      throw new Error('L3/L4 require two distinct moderators');
    }
    if (!founderApproved) throw new Error('L3/L4 require founder approval');
    if (!isFounderUser(founderUserId || moderatorId)) {
      throw new Error('Founder approval requires FOUNDER_USER_IDS (or ADMIN_USER_IDS) membership');
    }
  }

  let rsDelta = null;
  const cfg = LOCAL_CONFIG.mod;

  // L1 paket eşiği — korelasyon veya bağımsız 2. rapor (force ile aşılabilir)
  if (level === 'L1' && reportId && !forceBelowThreshold) {
    const r = await pool.query(
      `SELECT correlation_score, package_json FROM mod_reports WHERE id = $1`,
      [reportId]
    );
    if (r.rows.length) {
      const score = Number(r.rows[0].correlation_score || 0);
      let pkgJson = r.rows[0].package_json;
      if (typeof pkgJson === 'string') {
        try {
          pkgJson = JSON.parse(pkgJson);
        } catch (_e) {
          pkgJson = {};
        }
      }
      const factors = pkgJson?.factors || {};
      const minScore = Number(cfg.L1_PACKET_MIN || 2) * 0.2;
      const hasSecond = Number(factors.second_independent_report || 0) > 0;
      if (score < minScore && !hasSecond) {
        throw new Error(
          `L1 packet threshold not met (score ${score} < ${minScore}). Use force_below_threshold to override.`
        );
      }
    }
  }

  if (level === 'L0') {
    if (contentAction?.memory_id) {
      await pool.query(
        `UPDATE memories SET status = 'removed_mod', updated_at = NOW() WHERE id = $1`,
        [contentAction.memory_id]
      ).catch(() =>
        pool.query(`UPDATE memories SET status = 'draft' WHERE id = $1`, [contentAction.memory_id])
      );
    }
    // Profil düzelt — ceza yok, içerik temizliği + sicile not (mod_actions satırı)
    if (contentAction?.profile_user_id || (contentAction?.fix_profile && targetUserId)) {
      const pid = contentAction.profile_user_id || targetUserId;
      await pool.query(
        `UPDATE users
         SET bio = NULL,
             updated_at = NOW()
         WHERE id = $1`,
        [pid]
      ).catch(() => {});
    }
  } else if (level === 'L1') {
    await pool.query(
      `UPDATE users SET mod_warning_count = COALESCE(mod_warning_count,0) + 1, updated_at = NOW() WHERE id = $1`,
      [targetUserId]
    );
  } else if (level === 'L2a' || level === 'L2b') {
    // Host/ritual-open ban via mod_sanctions only — no full account suspend.
  } else if (level === 'L3') {
    const base = Number(cfg.L3_RS_BASE);
    const cap = Number(cfg.L3_RS_MAX);
    let delta = rsDeltaOverride != null ? Number(rsDeltaOverride) : base;
    if (delta > 0) delta = base; // only negative
    delta = Math.max(cap, Math.min(base, delta)); // between -0.30 and -0.15
    rsDelta = delta;
    await pool.query(
      `UPDATE users SET suspended_at = NOW(), rs_score = GREATEST(1, COALESCE(rs_score, 5) + $2), updated_at = NOW()
       WHERE id = $1`,
      [targetUserId, rsDelta]
    );
    try {
      await pool.query(
        `INSERT INTO rs_history (user_id, old_rs, new_rs, source, details)
         SELECT $1, rs_score - $2, rs_score, 'bypass', 'MOD-BYPASS L3'
         FROM users WHERE id = $1`,
        [targetUserId, rsDelta]
      );
    } catch (_e) {
      /* optional */
    }
  } else if (level === 'L4') {
    await pool.query(`UPDATE users SET suspended_at = NOW(), updated_at = NOW() WHERE id = $1`, [
      targetUserId,
    ]);
    await blacklistIdentityForUser(targetUserId);
  }

  const action = await pool.query(
    `INSERT INTO mod_actions (report_id, level, target_user_id, moderator_id, second_moderator_id, founder_approved, note, rs_delta)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [
      reportId || null,
      level,
      targetUserId || null,
      moderatorId || null,
      secondModeratorId,
      founderApproved,
      note,
      rsDelta,
    ]
  );
  const actionRow = action.rows[0];

  if (level === 'L2a' && targetUserId) {
    await insertSanction({
      userId: targetUserId,
      level,
      kind: 'ritual_host_ban',
      endsAt: hoursFromNow(cfg.L2A_H),
      actionId: actionRow.id,
    });
  }
  if (level === 'L2b' && targetUserId) {
    await insertSanction({
      userId: targetUserId,
      level,
      kind: 'ritual_host_ban',
      endsAt: daysFromNow(cfg.L2B_D),
      actionId: actionRow.id,
    });
    await insertSanction({
      userId: targetUserId,
      level,
      kind: 'free_location_ban',
      endsAt: daysFromNow(cfg.L2B_FREE_BAN_D),
      actionId: actionRow.id,
    });
  }
  if (level === 'L3' && targetUserId) {
    await insertSanction({
      userId: targetUserId,
      level,
      kind: 'full_suspend',
      endsAt: daysFromNow(cfg.L3_SUSPEND_D),
      actionId: actionRow.id,
    });
  }
  if (level === 'L4' && targetUserId) {
    await insertSanction({
      userId: targetUserId,
      level,
      kind: 'permanent_ban',
      endsAt: null,
      actionId: actionRow.id,
    });
  }

  if (reportId) {
    await pool.query(
      `UPDATE mod_reports SET status = 'actioned', level_applied = $2, updated_at = NOW() WHERE id = $1`,
      [reportId, level]
    );
  }
  return actionRow;
}

/** Asılsız raporcu → L1/L2 (RS değil). */
export async function sanctionFalseReporter({ reporterId, moderatorId, secondModeratorId = null, escalate = false }) {
  return applyModAction({
    reportId: null,
    level: escalate ? 'L2a' : 'L1',
    targetUserId: reporterId,
    moderatorId,
    secondModeratorId: escalate ? secondModeratorId || moderatorId : null,
    founderApproved: false,
    note: 'false_report_reporter_sanction',
  });
}

export async function createAppeal({ actionId, appellantId, reason }) {
  const action = await pool.query(`SELECT * FROM mod_actions WHERE id = $1`, [actionId]);
  if (!action.rows.length) throw new Error('Action not found');
  const a = action.rows[0];
  if (String(a.target_user_id) !== String(appellantId)) throw new Error('Only target may appeal');
  const r = await pool.query(
    `INSERT INTO mod_appeals (action_id, appellant_id, reason) VALUES ($1,$2,$3) RETURNING *`,
    [actionId, appellantId, reason || null]
  );
  return r.rows[0];
}

export async function resolveAppeal({ appealId, reviewerId, decision, decisionNote }) {
  const appeal = await pool.query(`SELECT * FROM mod_appeals WHERE id = $1`, [appealId]);
  if (!appeal.rows.length) throw new Error('Appeal not found');
  const ap = appeal.rows[0];
  const action = await pool.query(`SELECT * FROM mod_actions WHERE id = $1`, [ap.action_id]);
  const a = action.rows[0];
  if (
    reviewerId &&
    a &&
    (String(a.moderator_id) === String(reviewerId) || String(a.second_moderator_id) === String(reviewerId))
  ) {
    throw new Error('Appeal must be decided by a non-deciding moderator');
  }
  const status = decision === 'uphold' ? 'upheld' : 'overturned';
  const r = await pool.query(
    `UPDATE mod_appeals
     SET status = $2, reviewer_id = $3, decision_note = $4, resolved_at = NOW()
     WHERE id = $1 RETURNING *`,
    [appealId, status, reviewerId, decisionNote || null]
  );
  if (status === 'overturned' && a?.target_user_id) {
    await pool.query(
      `UPDATE mod_sanctions SET active = false WHERE action_id = $1`,
      [a.id]
    );
  }
  return r.rows[0];
}

export async function createLocationShare({ sharerId, friendId, ritualId }) {
  // FL1–FL3 only
  const fl = await pool.query(
    `SELECT friendship_level::text AS lvl FROM friendships
     WHERE status = 'accepted'
       AND (
         (user_id = $1 AND friend_id = $2) OR (friend_id = $1 AND user_id = $2)
         OR (requester_id = $1 AND receiver_id = $2) OR (receiver_id = $1 AND requester_id = $2)
       )
     LIMIT 1`,
    [sharerId, friendId]
  ).catch(() => ({ rows: [] }));
  const lvl = String(fl.rows[0]?.lvl || '').toLowerCase();
  if (!['l1', 'l2', 'l3'].includes(lvl)) {
    throw new Error('Location share only for FL1–FL3 friends');
  }

  let hours = LOCAL_CONFIG.mod.LOCATION_SHARE_DEFAULT_H || 1;
  if (ritualId) {
    const ritual = await pool.query(`SELECT duration FROM rituals WHERE id = $1`, [ritualId]);
    const durH = Math.max(0.25, (Number(ritual.rows[0]?.duration) || 60) / 60);
    // default 1h, Ritual süresini aşamaz
    hours = Math.min(hours, durH);
  }
  const expires = hoursFromNow(hours);
  const r = await pool.query(
    `INSERT INTO location_shares (sharer_id, friend_id, ritual_id, expires_at)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [sharerId, friendId, ritualId || null, expires]
  );
  return r.rows[0];
}

export async function listModQueue({ status = 'queued', limit = 50, offset = 0 } = {}) {
  const r = await pool.query(
    `SELECT mr.*,
            u.name AS reporter_name,
            EXTRACT(EPOCH FROM (mr.sla_due_at - NOW()))/3600.0 AS sla_hours_remaining
     FROM mod_reports mr
     LEFT JOIN users u ON u.id = mr.reporter_id
     WHERE ($1::text IS NULL OR mr.status = $1)
     ORDER BY
       CASE mr.queue_lane WHEN 'safety' THEN 0 WHEN 'content' THEN 1 WHEN 'ops' THEN 2 ELSE 3 END,
       mr.created_at ASC
     LIMIT $2 OFFSET $3`,
    [status, limit, offset]
  );
  return r.rows;
}

export default {
  createReport,
  applyModAction,
  buildReportPackage,
  correlationScore,
  scanPublicMedia,
  answerHostWitness,
  createAppeal,
  resolveAppeal,
  createLocationShare,
  listModQueue,
  canHostRitualMod,
  canUseFreeLocation,
  canEarnBadges,
  reporterBlockedFromGivingFeedback,
  sanctionFalseReporter,
  isModSuspended,
  hasActiveSanction,
  evaluateSilentExitPattern,
  maybeEnqueueSilentExitReview,
  maybeEnqueueDailyLeaveReview,
  falseWitnessPatternHit,
  evaluateFalseWitnessPattern,
  maybeEnqueueFalseWitnessReview,
  enqueueUnverifiedCheckinReview,
};
