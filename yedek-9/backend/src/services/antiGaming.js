import pool from '../config/database.js';
import LOCAL_CONFIG from '../config/localConfig.js';
import {
  computeDsSnapshot,
  getDsMultiplierFromState,
  persistDsState,
  updateDsForUser,
} from './dsEngine.js';

const N_CONTEXT_THRESHOLD = LOCAL_CONFIG.ds.N_CONTEXT_THRESHOLD;
const N_CONTEXT_DAYS = LOCAL_CONFIG.ds.N_CONTEXT_DAYS;

/**
 * @param {number} completedRitualIndex — 1-based
 */
export async function calculateDiversityMultiplierV3(
  userId,
  excludeRitualId,
  completedRitualIndex,
  options = {}
) {
  try {
    const snapshot = await computeDsSnapshot(userId, excludeRitualId, completedRitualIndex);
    if (options.persist !== false) {
      await persistDsState(userId, snapshot, excludeRitualId);
    }
    return {
      multiplier: snapshot.multiplier,
      dsEma: snapshot.dsEmaAdjusted,
      dsWindow: snapshot.dsWindow,
      dsFullEma: snapshot.dsEmaFull,
      tier: snapshot.tier,
    };
  } catch (error) {
    console.error('Error calculateDiversityMultiplierV3:', error);
    return { multiplier: 1.0, dsEma: LOCAL_CONFIG.ds.INIT, dsWindow: LOCAL_CONFIG.ds.INIT };
  }
}

export async function getDiversityMultiplierFromState(userId, completedRitualIndex) {
  return getDsMultiplierFromState(userId, completedRitualIndex);
}

/**
 * LTE-3 §6.3 — context_score over last 30 days; freeze positive delta only.
 */
export async function calculateNContextScore(userId, currentRitualId) {
  try {
    const cur = await pool.query(
      `SELECT r.location_name, r.type, r.start_time
       FROM rituals r WHERE r.id = $1`,
      [currentRitualId]
    );
    if (cur.rows.length === 0) return 0.5;

    const venueName = cur.rows[0].location_name;
    const typeVal = cur.rows[0].type || 'default';

    const since = new Date();
    since.setDate(since.getDate() - N_CONTEXT_DAYS);

    const past = await pool.query(
      `SELECT r.id, r.location_name, r.type
       FROM ritual_attendance ra
       JOIN rituals r ON r.id = ra.ritual_id
       WHERE ra.user_id = $1
         AND ra.status NOT IN ('no_show', 'cancelled')
         AND r.start_time >= $2
         AND r.id != $3`,
      [userId, since, currentRitualId]
    );

    if (past.rows.length === 0) {
      return 0.0;
    }

    let sameVenue = 0;
    let sameType = 0;
    for (const row of past.rows) {
      if (row.location_name === venueName) sameVenue++;
      if ((row.type || 'default') === typeVal) sameType++;
    }
    const n = past.rows.length;
    const venueOverlap = sameVenue / n;
    const typeOverlap = sameType / n;

    const currentAtt = await pool.query(
      `SELECT user_id FROM ritual_attendance
       WHERE ritual_id = $1 AND status NOT IN ('no_show', 'cancelled') AND user_id != $2`,
      [currentRitualId, userId]
    );
    const curPeers = new Set(currentAtt.rows.map((r) => r.user_id));

    let personOverlapSum = 0;
    for (const row of past.rows) {
      const pastAtt = await pool.query(
        `SELECT user_id FROM ritual_attendance
         WHERE ritual_id = $1 AND status NOT IN ('no_show', 'cancelled') AND user_id != $2`,
        [row.id, userId]
      );
      const pastPeers = new Set(pastAtt.rows.map((r) => r.user_id));
      let inter = 0;
      for (const p of curPeers) {
        if (pastPeers.has(p)) inter++;
      }
      const union = new Set([...curPeers, ...pastPeers]).size || 1;
      personOverlapSum += inter / union;
    }
    const personOverlap = personOverlapSum / past.rows.length;

    return 0.6 * personOverlap + 0.25 * venueOverlap + 0.15 * typeOverlap;
  } catch (error) {
    console.error('calculateNContextScore:', error);
    return 0.5;
  }
}

export function shouldFreezePositiveDelta(contextScore, deltaAfterDs) {
  return contextScore >= N_CONTEXT_THRESHOLD && deltaAfterDs > 0;
}

/** @deprecated MVP — use calculateDiversityMultiplierV3 */
export async function calculateDiversityMultiplier(userId, excludeRitualId = null) {
  const r = await calculateDiversityMultiplierV3(userId, excludeRitualId, 1);
  return r.multiplier;
}

export { updateDsForUser };

export default {
  calculateDiversityMultiplierV3,
  getDiversityMultiplierFromState,
  calculateNContextScore,
  shouldFreezePositiveDelta,
  calculateDiversityMultiplier,
  updateDsForUser,
};
