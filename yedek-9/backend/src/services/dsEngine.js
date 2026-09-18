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
  dsTrendFromEmaRaw,
  binDsValues,
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
  let placementComplete = true;
  try {
    const { getPlacementCompleteMap } = await import('./rsVisibility.js');
    const map = await getPlacementCompleteMap([userId]);
    placementComplete = map.get(String(userId)) === true;
  } catch (_e) {
    placementComplete = false;
  }

  const hiddenPayload = (extra = {}) => ({
    user_id: userId,
    hidden: true,
    hidden_reason: 'placement',
    placement_complete: false,
    note: 'Keşif Pusulası placement bitince açılır — yalnız sahibine.',
    ...extra,
  });

  if (!placementComplete) {
    return hiddenPayload();
  }

  const r = await pool.query(
    `SELECT *
     FROM user_diversity_state
     WHERE user_id = $1
     LIMIT 1`,
    [userId]
  );
  if (r.rows.length === 0) {
    const tier = tierFromDsFull(DS_INIT);
    const { trend, label: trend_label } = dsTrendFromEmaRaw(DS_INIT, DS_INIT);
    return {
      user_id: userId,
      placement_complete: true,
      hidden: false,
      ds_full_ema: DS_INIT,
      ds_tier: tier,
      ds_tier_label: tierLabelTr(tier),
      trend,
      trend_label,
      pd_score: null,
      ctxd_score: null,
      vd_score: null,
      city_curve: await getCityDsCurve(userId),
    };
  }
  const row = r.rows[0];
  const ema = row.ds_full_ema != null ? Number(row.ds_full_ema) : DS_INIT;
  const raw = row.ds_full != null ? Number(row.ds_full) : ema;
  const tier = row.ds_tier || tierFromDsFull(ema);
  const { trend, label: trend_label } = dsTrendFromEmaRaw(ema, raw);
  return {
    user_id: userId,
    placement_complete: true,
    hidden: false,
    ds_full_ema: ema,
    ds_tier: tier,
    ds_tier_label: tierLabelTr(tier),
    trend,
    trend_label,
    pd_score: row.pd_score != null ? Number(row.pd_score) : null,
    ctxd_score: row.ctxd_score != null ? Number(row.ctxd_score) : null,
    vd_score: row.vd_score != null ? Number(row.vd_score) : null,
    last_updated_at: row.last_updated_at,
    city_curve: await getCityDsCurve(userId),
  };
}

const CITY_DS_MIN_N = Number(LOCAL_CONFIG.ds.AGGREGATE_MIN_N) || 20;

export async function getCityDsCurveByCityId(cityId) {
  if (!cityId) return { hidden: true, reason: 'no_city', n: 0, min_n: CITY_DS_MIN_N };
  try {
    const rows = await pool.query(
      `SELECT uds.ds_full_ema
       FROM user_diversity_state uds
       JOIN users usr ON usr.id = uds.user_id
       WHERE usr.active_city_id = $1
         AND usr.deleted_at IS NULL
         AND uds.ds_full_ema IS NOT NULL`,
      [cityId]
    );
    return binDsValues(
      rows.rows.map((row) => row.ds_full_ema),
      CITY_DS_MIN_N
    );
  } catch (_e) {
    return { hidden: true, reason: 'unavailable', n: 0, min_n: CITY_DS_MIN_N };
  }
}

async function getCityDsCurve(userId) {
  try {
    const u = await pool.query(`SELECT active_city_id FROM users WHERE id = $1`, [userId]);
    return getCityDsCurveByCityId(u.rows[0]?.active_city_id);
  } catch (_e) {
    return null;
  }
}
