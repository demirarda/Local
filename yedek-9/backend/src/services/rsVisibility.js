/**
 * RS visibility — 24 Ağu
 * Placement: ilk 5 mühür + 5.'nin FB penceresi kapanınca ilk render.
 * FAR: 0 log-only (kimseye görünmez) · 1 sahip · 2 halka opt-in.
 */
import pool from '../config/database.js';
import LOCAL_CONFIG, { rsRingOpacity, farPhase } from '../config/localConfig.js';
import { getFeedbackClosesAt } from './feedbackWindow.js';

export async function getRsPublicFlags(userIds = []) {
  const unique = [...new Set((userIds || []).filter(Boolean).map(String))];
  const flags = new Map(unique.map((id) => [id, false]));
  if (unique.length === 0) return flags;

  const r = await pool.query(
    `SELECT user_id, COALESCE(show_rs_score_publicly, false) AS public
     FROM user_settings
     WHERE user_id = ANY($1::uuid[])`,
    [unique]
  );
  for (const row of r.rows) {
    flags.set(String(row.user_id), row.public === true);
  }
  return flags;
}

export async function getPlacementCompleteMap(userIds = []) {
  const unique = [...new Set((userIds || []).filter(Boolean).map(String))];
  const map = new Map(unique.map((id) => [id, false]));
  if (unique.length === 0) return map;
  const need = Number(LOCAL_CONFIG.rs.visibility?.PLACEMENT_SEALS || 5);

  const r = await pool.query(
    `SELECT user_id, ritual_id, checkin_at,
            ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY checkin_at ASC) AS rn
     FROM ritual_attendance
     WHERE user_id = ANY($1::uuid[])
       AND checkin_at IS NOT NULL
       AND COALESCE(checkin_phase, 'sealed') = 'sealed'`,
    [unique]
  );

  const fifthByUser = new Map();
  const counts = new Map();
  for (const row of r.rows) {
    const uid = String(row.user_id);
    counts.set(uid, (counts.get(uid) || 0) + 1);
    if (Number(row.rn) === need) fifthByUser.set(uid, row.ritual_id);
  }

  const ritualIds = [...new Set([...fifthByUser.values()])];
  const rituals = new Map();
  if (ritualIds.length > 0) {
    const rr = await pool.query(
      `SELECT * FROM rituals WHERE id = ANY($1::uuid[])`,
      [ritualIds]
    );
    for (const row of rr.rows) rituals.set(String(row.id), row);
  }

  const now = new Date();
  for (const uid of unique) {
    if ((counts.get(uid) || 0) < need) {
      map.set(uid, false);
      continue;
    }
    const rid = fifthByUser.get(uid);
    const ritual = rituals.get(String(rid));
    if (!ritual) {
      map.set(uid, false);
      continue;
    }
    const closes = getFeedbackClosesAt(ritual);
    map.set(uid, now > closes);
  }
  return map;
}

export async function getRsViewState(userIds = []) {
  const flags = await getRsPublicFlags(userIds);
  let placement = new Map();
  try {
    placement = await getPlacementCompleteMap(userIds);
  } catch (_e) {
    placement = new Map((userIds || []).map((id) => [String(id), true]));
  }
  return { flags, placement, farPhase: farPhase() };
}

function isViewState(obj) {
  return obj && typeof obj === 'object' && !(obj instanceof Map) && obj.flags instanceof Map;
}

/**
 * @param {string|null|undefined} viewerId
 * @param {string|null|undefined} targetUserId
 * @param {number|null|undefined} rsScore
 * @param {Map|object} [publicFlagsOrState]
 * @param {{ placementComplete?: boolean, farPhase?: number }} [opts]
 */
export function resolveRsForViewer(
  viewerId,
  targetUserId,
  rsScore,
  publicFlagsOrState = new Map(),
  opts = {}
) {
  if (targetUserId == null) {
    return {
      rs_score: null,
      rs_visible: false,
      rs_ring_opacity: null,
      rs_public_raw: false,
      rs_hidden_reason: 'no_target',
    };
  }
  const targetKey = String(targetUserId);
  const score = rsScore != null && Number.isFinite(Number(rsScore)) ? Number(rsScore) : null;
  const allowRaw = LOCAL_CONFIG.rs.visibility?.PUBLIC_RAW_SCORE === true;

  const state = isViewState(publicFlagsOrState) ? publicFlagsOrState : null;
  const publicFlags = state ? state.flags : publicFlagsOrState;
  const phase = opts.farPhase != null ? Number(opts.farPhase) : state?.farPhase ?? farPhase();
  const placementComplete =
    opts.placementComplete != null
      ? opts.placementComplete
      : state?.placement?.get(targetKey) ?? true;

  const hidden = (reason) => ({
    rs_score: null,
    rs_visible: false,
    rs_ring_opacity: null,
    rs_public_raw: false,
    rs_hidden_reason: reason,
  });

  if (!placementComplete) return hidden('placement');
  if (phase <= 0) return hidden('far_phase_0');

  if (viewerId != null && String(viewerId) === targetKey) {
    return {
      rs_score: score,
      rs_visible: true,
      rs_ring_opacity: score != null ? rsRingOpacity(score) : null,
      rs_public_raw: true,
    };
  }

  if (phase < 2) return hidden('far_phase_1');

  if (publicFlags.get(targetKey) === true) {
    return {
      rs_score: allowRaw ? score : null,
      rs_visible: true,
      rs_ring_opacity: score != null ? rsRingOpacity(score) : null,
      rs_public_raw: allowRaw,
    };
  }

  return hidden('private');
}

export function maskRsFields(items, viewerId, publicFlags, idKey = 'id') {
  if (!Array.isArray(items)) return items;
  return items.map((item) => {
    const uid = item?.[idKey] ?? item?.user_id;
    const resolved = resolveRsForViewer(viewerId, uid, item?.rs_score, publicFlags);
    return {
      ...item,
      rs_score: resolved.rs_score,
      rs_visible: resolved.rs_visible,
      rs_ring_opacity: resolved.rs_ring_opacity,
    };
  });
}

/**
 * §9 — ham sayı public asla. Liste payload'larında rs_score / user_rs_score maskele.
 */
export async function maskRsScoreList(items, viewerId, { idKey = 'user_id', scoreKey = 'user_rs_score' } = {}) {
  if (!Array.isArray(items) || items.length === 0) return items;
  const ids = items.map((item) => item?.[idKey]).filter(Boolean);
  const state = await getRsViewState(ids);
  return items.map((item) => {
    const resolved = resolveRsForViewer(viewerId, item?.[idKey], item?.[scoreKey], state);
    return { ...item, [scoreKey]: resolved.rs_score };
  });
}
