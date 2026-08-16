/**
 * sonMD E3.5 — RS visibility: owner always full score;
 * others only opt-in monochrome ring (no raw public number).
 */
import pool from '../config/database.js';
import LOCAL_CONFIG, { rsRingOpacity } from '../config/localConfig.js';

/**
 * @param {string[]} userIds
 * @returns {Promise<Map<string, boolean>>}
 */
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

/**
 * @param {string|null|undefined} viewerId
 * @param {string|null|undefined} targetUserId
 * @param {number|null|undefined} rsScore
 * @param {Map<string, boolean>} [publicFlags]
 */
export function resolveRsForViewer(viewerId, targetUserId, rsScore, publicFlags = new Map()) {
  if (targetUserId == null) {
    return {
      rs_score: null,
      rs_visible: false,
      rs_ring_opacity: null,
      rs_public_raw: false,
    };
  }
  const targetKey = String(targetUserId);
  const score = rsScore != null && Number.isFinite(Number(rsScore)) ? Number(rsScore) : null;
  const allowRaw = LOCAL_CONFIG.rs.visibility?.PUBLIC_RAW_SCORE === true;

  if (viewerId != null && String(viewerId) === targetKey) {
    return {
      rs_score: score,
      rs_visible: true,
      rs_ring_opacity: score != null ? rsRingOpacity(score) : null,
      rs_public_raw: true,
    };
  }

  if (publicFlags.get(targetKey) === true) {
    return {
      rs_score: allowRaw ? score : null,
      rs_visible: true,
      rs_ring_opacity: score != null ? rsRingOpacity(score) : null,
      rs_public_raw: allowRaw,
    };
  }

  return {
    rs_score: null,
    rs_visible: false,
    rs_ring_opacity: null,
    rs_public_raw: false,
  };
}

/**
 * Batch mask RS on objects with `id` or `user_id` + `rs_score`.
 */
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
