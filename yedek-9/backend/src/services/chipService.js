/**
 * Chip helpers — LOCAL v2 §10
 * Tek seçim · rastgele sıra · skip serbest · route · n≥10 public · 🟡 kalibrasyon
 */
import pool from '../config/database.js';
import LOCAL_CONFIG from '../config/localConfig.js';
import { auraWordForChip } from '../i18n/auraCopyMap.js';
import { p2zChipLane } from './megaZone.js';
import { assertChipPair } from './megaFb.js';

const FEELINGS = new Set(['green', 'yellow', 'red']);

/** RQ / P2V / P2Z / P2C / P2P(K1) / K2 / E / S / VR */
export function chipSetKey(kind, feeling) {
  const k = String(kind || 'RQ').toUpperCase();
  const f = String(feeling || '').toLowerCase();
  const suffix = f === 'red' ? 'RED' : f === 'yellow' ? 'YELLOW' : 'GREEN';
  if (k === 'P2V') return `P2V_${suffix}`;
  if (k === 'P2Z') return `P2Z_${suffix}`;
  if (k === 'P2C') return `P2C_${suffix}`;
  if (k === 'P2P' || k === 'K1') return `P2P_${suffix}`;
  if (k === 'K2') return `K2_${suffix}`;
  if (k === 'E') return `E_${suffix}`;
  if (k === 'S') return `S_${suffix}`;
  if (k === 'VR') return `VR_${suffix}`;
  return `RQ_${suffix}`;
}

export function chipsForFeeling(kind, feeling) {
  const sets = LOCAL_CONFIG.chip?.SETS || {};
  const key = chipSetKey(kind, feeling);
  const list = [...(sets[key] || [])];
  if (LOCAL_CONFIG.chip?.ROTATE) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
  }
  return list.map((id) => ({
    id,
    route: routeForChip(id),
    label_key: id,
  }));
}

export function routeForChip(chipId) {
  return LOCAL_CONFIG.chip?.ROUTES?.[chipId] || LOCAL_CONFIG.chip?.ROUTES?.default || 'host_private';
}

export function allKnownChipIds() {
  const sets = LOCAL_CONFIG.chip?.SETS || {};
  const ids = new Set();
  for (const list of Object.values(sets)) {
    for (const id of list || []) ids.add(id);
  }
  return ids;
}

export function chipKindForFeedbackType(feedbackType) {
  const t = String(feedbackType || '').toLowerCase();
  if (t === 'p2v' || t === 'p2m') return 'P2V';
  if (t === 'p2z') return 'P2Z';
  if (t === 'p2c') return 'P2C';
  if (t === 'p2s' || t === 'seller') return 'S';
  if (t === 'vr') return 'VR';
  if (t === 'rq_event') return 'E';
  if (t === 'p2p' || t === 'p2host') {
    return LOCAL_CONFIG.chip?.P2P_ENABLED !== false ? 'P2P' : null;
  }
  if (t === 'p2r' || t === 'rq') return 'RQ';
  return null;
}

export function feelingForChipContext({
  feedbackType,
  p2r_feeling,
  p2v_feeling,
  r1_self,
  q1_comfort,
  q2_energy,
  axis,
} = {}) {
  const kind = chipKindForFeedbackType(feedbackType);
  if (axis === 'q2' || kind === 'K2') return q2_energy || null;
  if (kind === 'P2V') return p2v_feeling || null;
  if (kind === 'P2P') return q1_comfort || p2r_feeling || r1_self || null;
  if (kind === 'RQ' || kind === 'P2Z' || kind === 'P2C' || kind === 'E' || kind === 'S' || kind === 'VR') {
    return p2r_feeling || p2v_feeling || r1_self || null;
  }
  return null;
}

/**
 * Validate optional chip_id for feedback type + feeling.
 * Skip (null/empty) always OK. P2H (host) carries no chips; P2P chips are on (EK-26).
 */
export function validateChipSelection({
  feedbackType,
  chipId,
  p2r_feeling,
  p2v_feeling,
  r1_self,
  q1_comfort,
  q2_energy,
  axis,
  chipId2,
} = {}) {
  const raw = chipId != null ? String(chipId).trim() : '';
  if (!raw) return { ok: true, chip_id: null, chip_route: null };

  const kind = axis === 'q2' ? 'K2' : chipKindForFeedbackType(feedbackType);
  if (!kind) {
    return { ok: false, error: 'Bu feedback tipinde chip yok' };
  }
  const feeling = feelingForChipContext({
    feedbackType,
    p2r_feeling,
    p2v_feeling,
    r1_self,
    q1_comfort,
    q2_energy,
    axis,
  });
  if (!feeling || !FEELINGS.has(feeling)) {
    return { ok: false, error: 'Chip icin once kategori secilmeli' };
  }
  const allowed = new Set(LOCAL_CONFIG.chip?.SETS?.[chipSetKey(kind, feeling)] || []);
  if (!allowed.has(raw)) {
    return { ok: false, error: 'Gecersiz chip_id' };
  }
  if (LOCAL_CONFIG.chip?.SINGLE_SELECT !== false && raw.includes(',')) {
    return { ok: false, error: 'Tek chip secimi' };
  }
  if (chipId2) {
    const pair = assertChipPair({ feeling, chipIds: [raw, chipId2] });
    if (!pair.ok) return pair;
    const allowed2 = new Set([
      ...(LOCAL_CONFIG.chip?.SETS?.[chipSetKey(kind, feeling)] || []),
      ...(LOCAL_CONFIG.chip?.SETS?.[chipSetKey(kind, 'yellow')] || []),
      ...(feeling === 'yellow'
        ? [
            ...(LOCAL_CONFIG.chip?.SETS?.[chipSetKey(kind, 'green')] || []),
            ...(LOCAL_CONFIG.chip?.SETS?.[chipSetKey(kind, 'red')] || []),
          ]
        : []),
    ]);
    if (!allowed2.has(String(chipId2))) {
      return { ok: false, error: 'Gecersiz ikinci chip' };
    }
  }
  return { ok: true, chip_id: raw, chip_route: routeForChip(raw) };
}

export async function upsertFeedbackChipStats(venueId, chipId, feeling) {
  if (!venueId || !chipId || !feeling) return;
  const f = String(feeling).toLowerCase();
  if (!FEELINGS.has(f)) return;
  await pool.query(
    `INSERT INTO feedback_chip_stats (venue_id, chip_id, feeling, count)
     VALUES ($1, $2, $3, 1)
     ON CONFLICT (venue_id, chip_id, feeling)
     DO UPDATE SET count = feedback_chip_stats.count + 1`,
    [venueId, chipId, f]
  );
}

/** Ops route → zone bakım kuyruğu */
export async function recordOpsChipTelemetry({ chipId, ritualId, userId } = {}) {
  const route = routeForChip(chipId);
  const lane = p2zChipLane(chipId);
  if (lane !== 'ops' && route !== 'ops' && route !== 'zone_ops') return;
  try {
    await pool.query(
      `INSERT INTO score_events (user_id, event_type, delta, meta, created_at)
       VALUES ($1, 'chip_ops_telemetry', 0, $2::jsonb, NOW())`,
      [
        userId || null,
        JSON.stringify({
          chip_id: chipId,
          ritual_id: ritualId || null,
          route: 'ops',
          note: 'ZONE-OPS (totem/oturma/işaret/temizlik)',
        }),
      ]
    ).catch(() => {});
    if (ritualId) {
      const z = await pool.query(`SELECT zone_id FROM rituals WHERE id = $1`, [ritualId]);
      if (z.rows[0]?.zone_id) {
        const { enqueueZoneOps } = await import('./zoneService.js');
        await enqueueZoneOps({
          zoneId: z.rows[0].zone_id,
          ritualId,
          chipId,
          userId,
        });
      }
    }
  } catch (_e) {
    /* optional table */
  }
}

function aggregateChipRows(rows) {
  const byChip = {};
  let totalWithChip = 0;
  for (const row of rows || []) {
    const id = row.chip_id;
    if (!id) continue;
    if (!byChip[id]) {
      byChip[id] = {
        chip_id: id,
        label: auraWordForChip(id),
        green: 0,
        yellow: 0,
        red: 0,
        total: 0,
      };
    }
    const f = String(row.feeling || '').toLowerCase();
    const n = Number(row.count) || 0;
    if (f === 'green') byChip[id].green += n;
    else if (f === 'yellow') byChip[id].yellow += n;
    else if (f === 'red') byChip[id].red += n;
    byChip[id].total += n;
    totalWithChip += n;
  }
  const breakdown = Object.values(byChip).sort((a, b) => b.total - a.total);
  return { breakdown, totalWithChip };
}

/** Ritüel top-chip: en az N farklı cevaplayan olmadan public değil. */
export function ritualTopChipPublic({ distinctAnswerCount, minDistinct } = {}) {
  const min =
    minDistinct != null
      ? Number(minDistinct)
      : Number(LOCAL_CONFIG.chip?.TOP_CHIP_RITUAL_MIN_DISTINCT) || 3;
  return Number(distinctAnswerCount) >= min;
}

/**
 * Public ritüel chip özeti — kişi puanı değil, ritüel kırılımı.
 * n < TOP_CHIP_RITUAL_MIN_DISTINCT gizlenir.
 */
export async function getPublicRitualChipBreakdown(ritualId) {
  const minDistinct = Number(LOCAL_CONFIG.chip?.TOP_CHIP_RITUAL_MIN_DISTINCT) || 3;
  if (!ritualId) {
    return {
      ok: true,
      ritual_id: ritualId,
      hidden: true,
      breakdown: [],
      person_score: null,
    };
  }

  const [grouped, distinctR] = await Promise.all([
    pool
      .query(
        `SELECT f.chip_id,
                LOWER(COALESCE(f.p2v_feeling, f.p2r_feeling, f.r1_self, '')) AS feeling,
                COUNT(*)::int AS count
         FROM feedback f
         WHERE f.ritual_id = $1 AND f.chip_id IS NOT NULL
         GROUP BY f.chip_id, LOWER(COALESCE(f.p2v_feeling, f.p2r_feeling, f.r1_self, ''))`,
        [ritualId]
      )
      .catch(() => ({ rows: [] })),
    pool
      .query(
        `SELECT COUNT(DISTINCT from_user_id)::int AS n
         FROM feedback
         WHERE ritual_id = $1 AND chip_id IS NOT NULL`,
        [ritualId]
      )
      .catch(() => ({ rows: [{ n: 0 }] })),
  ]);

  const distinctAnswers = Number(distinctR.rows[0]?.n || 0);
  const { breakdown, totalWithChip } = aggregateChipRows(grouped.rows);
  const publicOk = ritualTopChipPublic({ distinctAnswerCount: distinctAnswers, minDistinct });
  const visible = publicOk ? breakdown : [];

  return {
    ok: true,
    ritual_id: ritualId,
    public_min_distinct: minDistinct,
    distinct_answers: distinctAnswers,
    total_chip_answers: totalWithChip,
    hidden: visible.length === 0,
    breakdown: visible,
    /** Spec: kişi geçmişi kişi puanı değil ritüel özeti */
    person_score: null,
    teaser:
      !publicOk && distinctAnswers > 0
        ? `Chip ozeti ${minDistinct} farkli cevap olunca acilir`
        : null,
  };
}

/**
 * Public venue chip kırılımı — n < PUBLIC_MIN_N gizlenir.
 */
export async function getPublicChipBreakdown(venueId) {
  const minN = Number(LOCAL_CONFIG.chip?.PUBLIC_MIN_N) || 10;
  const stats = await pool.query(
    `SELECT chip_id, feeling, count
     FROM feedback_chip_stats
     WHERE venue_id = $1
     ORDER BY count DESC`,
    [venueId]
  ).catch(() => ({ rows: [] }));

  let rows = stats.rows;
  if (!rows.length) {
    const live = await pool.query(
      `SELECT f.chip_id,
              LOWER(COALESCE(f.p2v_feeling, f.p2r_feeling, f.r1_self, '')) AS feeling,
              COUNT(*)::int AS count
       FROM feedback f
       JOIN rituals r ON r.id = f.ritual_id
       WHERE r.venue_id = $1 AND f.chip_id IS NOT NULL
       GROUP BY f.chip_id, LOWER(COALESCE(f.p2v_feeling, f.p2r_feeling, f.r1_self, ''))`,
      [venueId]
    ).catch(() => ({ rows: [] }));
    rows = live.rows;
  }

  const { breakdown, totalWithChip } = aggregateChipRows(rows);
  const visible = breakdown.filter((c) => c.total >= minN);

  return {
    ok: true,
    venue_id: venueId,
    public_min_n: minN,
    hidden: visible.length === 0,
    total_chip_answers: totalWithChip,
    breakdown: visible,
    teaser:
      visible.length === 0 && totalWithChip > 0
        ? `Chip kirilimi n≥${minN} olunca acilir`
        : null,
  };
}

/** Admin: 🟡 cevaplarda chip kullanım oranı */
export async function getYellowChipCalibration({ days = 30 } = {}) {
  const d = Math.max(1, Math.min(365, Number(days) || 30));
  const r = await pool.query(
    `SELECT
       COUNT(*) FILTER (
         WHERE LOWER(COALESCE(p2r_feeling, p2v_feeling, '')) = 'yellow'
       )::int AS yellow_total,
       COUNT(*) FILTER (
         WHERE LOWER(COALESCE(p2r_feeling, p2v_feeling, '')) = 'yellow'
           AND chip_id IS NOT NULL
       )::int AS yellow_with_chip,
       COUNT(*) FILTER (
         WHERE chip_id IS NOT NULL
       )::int AS any_with_chip,
       COUNT(*)::int AS feedback_total
     FROM feedback
     WHERE submitted_at >= NOW() - ($1::text || ' days')::interval
        OR created_at >= NOW() - ($1::text || ' days')::interval`,
    [String(d)]
  );
  const row = r.rows[0] || {};
  const yellowTotal = Number(row.yellow_total) || 0;
  const yellowWithChip = Number(row.yellow_with_chip) || 0;
  const rate = yellowTotal > 0 ? Math.round((yellowWithChip / yellowTotal) * 1000) / 10 : null;
  return {
    ok: true,
    window_days: d,
    yellow_total: yellowTotal,
    yellow_with_chip: yellowWithChip,
    yellow_chip_usage_pct: rate,
    any_with_chip: Number(row.any_with_chip) || 0,
    feedback_total: Number(row.feedback_total) || 0,
  };
}

export function getChipPublicConfig() {
  return {
    single_select: LOCAL_CONFIG.chip?.SINGLE_SELECT !== false,
    max_chip_select: Number(LOCAL_CONFIG.chip?.MAX_CHIP_SELECT) || 2,
    rotate: Boolean(LOCAL_CONFIG.chip?.ROTATE),
    public_min_n: LOCAL_CONFIG.chip?.PUBLIC_MIN_N || 10,
    top_chip_ritual_min_distinct: LOCAL_CONFIG.chip?.TOP_CHIP_RITUAL_MIN_DISTINCT || 3,
    sets: LOCAL_CONFIG.chip?.SETS || {},
    routes: LOCAL_CONFIG.chip?.ROUTES || {},
    /** EK-26 P2P-CHIP KESİN — p2host (self) hâlâ yok */
    no_chips_for: LOCAL_CONFIG.chip?.P2P_ENABLED === false ? ['p2p', 'p2host'] : ['p2host'],
    fiyat_open: true,
    min_chips_per_branch: Number(LOCAL_CONFIG.chip?.MIN_CHIPS_PER_BRANCH ?? 4),
    p2p_max_people: Number(LOCAL_CONFIG.chip?.P2P_MAX_PEOPLE ?? 2),
  };
}
