/**
 * DS motoru — son-part.md §6
 * Çift çıktı: DS_adjusted (RS çarpanı) + DS_full (private tier)
 */
import pool from '../config/database.js';
import LOCAL_CONFIG, {
  computeDsMultiplierFromEma,
  computeDsRaw,
  dsFlWeight,
  isExcludedFromDsAdjusted,
  tierFromDsFull,
  updateDsEma,
  tierLabelTr,
  computeWindowVd,
} from '../config/localConfig.js';
import { getFlMetaForPair } from './friendshipLevel.js';

const WINDOW_N = LOCAL_CONFIG.ds.RITUAL_WINDOW;
const DS_INIT = LOCAL_CONFIG.ds.INIT;

export async function countSharedRituals(userId, otherUserId) {
  const r = await pool.query(
    `SELECT COUNT(DISTINCT ra1.ritual_id)::int AS c
     FROM ritual_attendance ra1
     INNER JOIN ritual_attendance ra2 ON ra1.ritual_id = ra2.ritual_id
     WHERE ra1.user_id = $1 AND ra2.user_id = $2
       AND ra1.status NOT IN ('no_show', 'cancelled')
       AND ra2.status NOT IN ('no_show', 'cancelled')`,
    [userId, otherUserId]
  );
  return r.rows[0]?.c ?? 0;
}

async function getPeerDsMeta(userId, peerId, cache) {
  const key = `${userId}:${peerId}`;
  if (cache.has(key)) return cache.get(key);

  const fl = await getFlMetaForPair(userId, peerId);
  // v2 §6: DS-Regular weight removed; DS peer weighting depends only on FL tiers.
  const isRegular = false;
  const meta = {
    level: fl.friendship_level,
    isRegular,
    flWeight: dsFlWeight(fl.friendship_level, isRegular),
    excludedFromAdjusted: isExcludedFromDsAdjusted(fl.friendship_level, isRegular),
  };
  cache.set(key, meta);
  return meta;
}

async function getLastRituals(userId, excludeRitualId = null) {
  const params = [userId];
  let excludeSql = '';
  if (excludeRitualId) {
    excludeSql = ' AND r.id != $2';
    params.push(excludeRitualId);
  }
  params.push(WINDOW_N);

  const r = await pool.query(
    `SELECT r.id, r.type, r.location_name, r.capacity, r.start_time
     FROM ritual_attendance ra
     JOIN rituals r ON r.id = ra.ritual_id
     WHERE ra.user_id = $1
       AND ra.status NOT IN ('no_show', 'cancelled')
       ${excludeSql}
     ORDER BY r.start_time DESC
     LIMIT $${params.length}`,
    params
  );
  return r.rows;
}

function capacityDenominator(ritual) {
  const cap = LOCAL_CONFIG.ds.MAX_WINDOW_CAPACITY;
  if (cap != null && Number.isFinite(Number(cap))) return Math.max(1, Number(cap));
  return Math.max(1, Number(ritual.capacity) || 1);
}

async function ritualPeerIds(ritualId, userId) {
  const r = await pool.query(
    `SELECT user_id FROM ritual_attendance
     WHERE ritual_id = $1
       AND user_id != $2
       AND status NOT IN ('no_show', 'cancelled')`,
    [ritualId, userId]
  );
  return r.rows.map((x) => x.user_id);
}

/**
 * Kapalı çekirdek: FL3-dışı efektif katılımcı ≤1 → DS güncellemesi atlanır
 */
export async function shouldSkipDsUpdateForRitual(userId, ritualId) {
  const peerIds = await ritualPeerIds(ritualId, userId);
  const cache = new Map();
  let effective = 0;
  for (const peerId of peerIds) {
    const meta = await getPeerDsMeta(userId, peerId, cache);
    if (!meta.excludedFromAdjusted) effective += 1;
  }
  return effective <= 1;
}

async function computeWindowComponents(userId, excludeRitualId = null) {
  const rituals = await getLastRituals(userId, excludeRitualId);
  if (rituals.length === 0) {
    return {
      pdAdjusted: 0,
      pdFull: 0,
      ctxD: 0,
      vd: 0,
      ritualCount: 0,
    };
  }

  const cache = new Map();
  let pdAdjSum = 0;
  let pdFullSum = 0;

  for (const ritual of rituals) {
    const peerIds = await ritualPeerIds(ritual.id, userId);
    const denom = capacityDenominator(ritual);

    const adjPeers = new Set();
    let fullWeightSum = 0;
    const fullPeers = new Set();

    for (const peerId of peerIds) {
      const meta = await getPeerDsMeta(userId, peerId, cache);
      if (!meta.excludedFromAdjusted) adjPeers.add(peerId);
      if (!fullPeers.has(peerId)) {
        fullPeers.add(peerId);
        fullWeightSum += meta.flWeight;
      }
    }

    pdAdjSum += Math.min(1, adjPeers.size / denom);
    pdFullSum += Math.min(1, fullWeightSum / denom);
  }

  const n = rituals.length;
  const uniqueVenues = new Set(rituals.map((r) => r.location_name)).size;
  const uniqueTypes = new Set(rituals.map((r) => r.type || 'default')).size;
  const vdDenom = LOCAL_CONFIG.ds.MAX_WINDOW_CAPACITY;

  return {
    pdAdjusted: pdAdjSum / n,
    pdFull: pdFullSum / n,
    ctxD: Math.min(1, uniqueTypes / Math.max(1, n)),
    vd: Math.min(1, uniqueVenues / Math.max(1, vdDenom)),
    ritualCount: n,
  };
}

export async function computeDsSnapshot(userId, excludeRitualId = null, completedRitualIndex = 1) {
  const components = await computeWindowComponents(userId, excludeRitualId);

  const dsRawAdjusted = computeDsRaw(components.pdAdjusted, components.ctxD, components.vd);
  const dsRawFull = computeDsRaw(components.pdFull, components.ctxD, components.vd);

  const dsPrev = await getOrInitDiversityState(userId);
  const dsEmaAdjusted = updateDsEma(dsPrev.adjusted, dsRawAdjusted);
  const dsEmaFull = updateDsEma(dsPrev.full, dsRawFull);

  const multiplier = computeDsMultiplierFromEma(dsEmaAdjusted, completedRitualIndex);
  const tier = tierFromDsFull(dsEmaFull);

  return {
    components,
    dsRawAdjusted,
    dsRawFull,
    dsEmaAdjusted,
    dsEmaFull,
    multiplier,
    tier,
    dsWindow: dsRawAdjusted,
  };
}

async function getOrInitDiversityState(userId) {
  try {
    const result = await pool.query(
      `SELECT ds_prev, ds_full_ema FROM user_diversity_state WHERE user_id = $1`,
      [userId]
    );
    if (result.rows.length > 0) {
      const adj = parseFloat(result.rows[0].ds_prev);
      const full = parseFloat(result.rows[0].ds_full_ema);
      return {
        adjusted: Number.isFinite(adj) ? adj : DS_INIT,
        full: Number.isFinite(full) ? full : DS_INIT,
      };
    }
    await pool.query(
      `INSERT INTO user_diversity_state (user_id, ds_prev, ds_full_ema)
       VALUES ($1, $2, $2)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId, DS_INIT]
    );
    return { adjusted: DS_INIT, full: DS_INIT };
  } catch {
    return { adjusted: DS_INIT, full: DS_INIT };
  }
}

export async function persistDsState(userId, snapshot, ritualId = null) {
  const {
    dsEmaAdjusted,
    dsEmaFull,
    dsRawAdjusted,
    dsRawFull,
    multiplier,
    tier,
    components,
  } = snapshot;

  await pool.query(
    `INSERT INTO user_diversity_state (
       user_id, ds_prev, ds_full_ema, ds_raw, ds_full, ds_tier, ds_multiplier,
       pd_score, ctxd_score, vd_score, last_ritual_id, last_updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,CURRENT_TIMESTAMP)
     ON CONFLICT (user_id) DO UPDATE SET
       ds_prev = EXCLUDED.ds_prev,
       ds_full_ema = EXCLUDED.ds_full_ema,
       ds_raw = EXCLUDED.ds_raw,
       ds_full = EXCLUDED.ds_full,
       ds_tier = EXCLUDED.ds_tier,
       ds_multiplier = EXCLUDED.ds_multiplier,
       pd_score = EXCLUDED.pd_score,
       ctxd_score = EXCLUDED.ctxd_score,
       vd_score = EXCLUDED.vd_score,
       last_ritual_id = EXCLUDED.last_ritual_id,
       last_updated_at = CURRENT_TIMESTAMP`,
    [
      userId,
      dsEmaAdjusted,
      dsEmaFull,
      dsRawAdjusted,
      dsRawFull,
      tier,
      multiplier,
      components.pdAdjusted,
      components.ctxD,
      components.vd,
      ritualId,
    ]
  );

  try {
    await pool.query(
      `UPDATE users
       SET ds_ema = $2, ds_score = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [userId, dsEmaAdjusted, dsRawAdjusted]
    );
  } catch (e) {
    if (e.code !== '42703') throw e;
  }
}

export async function updateDsForUser(userId, ritualId = null) {
  if (!userId) return { skipped: true, reason: 'missing_user_id' };

  if (ritualId && (await shouldSkipDsUpdateForRitual(userId, ritualId))) {
    return { skipped: true, reason: 'closed_core', user_id: userId, ritual_id: ritualId };
  }

  const completedRitualIndex = await getCompletedRitualCount(userId);
  const prevTierR = await pool.query(
    `SELECT ds_tier FROM user_diversity_state WHERE user_id = $1`,
    [userId]
  );
  const prevTier = prevTierR.rows[0]?.ds_tier || null;

  const snapshot = await computeDsSnapshot(userId, null, completedRitualIndex);
  await persistDsState(userId, snapshot, ritualId);

  if (snapshot.tier && prevTier && snapshot.tier !== prevTier) {
    const { notifyDsTierPrivate } = await import('./notifications.js');
    await notifyDsTierPrivate(userId, {
      oldTier: prevTier,
      newTier: snapshot.tier,
      tierLabel: tierLabelTr(snapshot.tier),
    }).catch(() => {});
  }

  return {
    user_id: userId,
    ritual_id: ritualId,
    ds_ema: snapshot.dsEmaAdjusted,
    ds_full_ema: snapshot.dsEmaFull,
    ds_raw: snapshot.dsRawAdjusted,
    ds_full: snapshot.dsRawFull,
    ds_tier: snapshot.tier,
    multiplier: snapshot.multiplier,
    components: snapshot.components,
    completed_rituals: completedRitualIndex,
  };
}

async function getCompletedRitualCount(userId) {
  const result = await pool.query(
    `SELECT COUNT(DISTINCT ritual_id)::int AS c
     FROM ritual_attendance
     WHERE user_id = $1
       AND status::text NOT IN ('no_show', 'cancelled')`,
    [userId]
  );
  return result.rows[0]?.c || 0;
}

export async function getDsMultiplierFromState(userId, completedRitualIndex = 1) {
  const state = await getOrInitDiversityState(userId);
  const multiplier = computeDsMultiplierFromEma(state.adjusted, completedRitualIndex);
  return { multiplier, dsEma: state.adjusted, dsFullEma: state.full };
}

export async function getPrivateDsDashboard(userId) {
  const r = await pool.query(
    `SELECT *
     FROM user_diversity_state
     WHERE user_id = $1
     LIMIT 1`,
    [userId]
  );
  if (r.rows.length === 0) {
    const tier = tierFromDsFull(DS_INIT);
    return {
      user_id: userId,
      ds_ema: DS_INIT,
      ds_full_ema: DS_INIT,
      ds_tier: tier,
      ds_tier_label: tierLabelTr(tier),
      ds_multiplier: computeDsMultiplierFromEma(DS_INIT, 1),
      pd_score: null,
      ctxd_score: null,
      vd_score: null,
    };
  }
  const row = r.rows[0];
  const tier = row.ds_tier || tierFromDsFull(row.ds_full_ema);
  return {
    user_id: userId,
    ds_ema: row.ds_prev != null ? Number(row.ds_prev) : DS_INIT,
    ds_full_ema: row.ds_full_ema != null ? Number(row.ds_full_ema) : DS_INIT,
    ds_raw: row.ds_raw != null ? Number(row.ds_raw) : null,
    ds_full: row.ds_full != null ? Number(row.ds_full) : null,
    ds_tier: tier,
    ds_tier_label: tierLabelTr(tier),
    ds_multiplier: row.ds_multiplier != null
      ? Number(row.ds_multiplier)
      : computeDsMultiplierFromEma(row.ds_prev, 1),
    pd_score: row.pd_score != null ? Number(row.pd_score) : null,
    ctxd_score: row.ctxd_score != null ? Number(row.ctxd_score) : null,
    vd_score: row.vd_score != null ? Number(row.vd_score) : null,
    last_updated_at: row.last_updated_at,
  };
}
