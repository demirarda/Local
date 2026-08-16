import pool from '../config/database.js';
import LOCAL_CONFIG, {
  getLateCancelRsPenalty,
  getNoShowRsPenalty,
  getNoShowSuspensionHours,
  isFreeCancelWindow,
} from '../config/localConfig.js';
import { notifyBadgeEarned } from './notifications.js';
import {
  afterHostNoShowPenalty,
  afterLateCancelPenalty,
  afterNoShowPenalty,
  countRollingStrikes,
} from './penaltyService.js';
import { logScoreEvent } from './scoreEventService.js';

const NAZIK_IPTAL_BADGE_KEY = 'nazik_iptal';
const NAZIK_IPTAL_BADGE_LABEL = 'Nazik Iptal';

/** @returns {{ no_show_count: number, late_cancel_count: number }} */
export async function getBypassState(userId) {
  const noShow = await countRollingStrikes(userId, 'no_show');
  const lateCancel = await countRollingStrikes(userId, 'late_cancel');
  return { no_show_count: noShow, late_cancel_count: lateCancel };
}

/**
 * son-part.md §7.2 — no-show RS: 1. −0.08 · 2. −0.15 · 3+ −0.20 + askı (3.+ strike)
 */
export async function recordNoShowEvent(userId, ritualId) {
  const prior = await countRollingStrikes(userId, 'no_show');
  const strike = prior + 1;
  const penalty = getNoShowRsPenalty(strike);

  if (penalty == null) {
    return { kind: 'warning', strike };
  }

  const result = await applyDirectPenalty(userId, ritualId, penalty, 'no_show');
  await afterNoShowPenalty(userId, ritualId, strike, result.delta);
  return { ...result, strike, suspension: getNoShowSuspensionHours(strike) };
}

/**
 * son-part.md §7.1 — late-cancel: 1:uyarı · 2:−0.06 · 3:−0.10 · 4+:−0.15 (askı yok)
 */
export async function recordLateCancelEvent(userId, ritualId, context = {}) {
  const pctUntilStart = context.pct_until_start;
  const hoursUntilStart = context.hours_until_start;
  let ritual = context.ritual;
  if (!ritual && ritualId) {
    const r = await pool.query(
      `SELECT id, start_time, duration FROM rituals WHERE id = $1`,
      [ritualId]
    );
    ritual = r.rows[0] || null;
  }

  if (ritual && isFreeCancelWindow(ritual, context.now || new Date())) {
    const badge = await awardNazikIptalBadge(userId, ritualId);
    return { kind: 'none', reason: 'early_cancel', badge };
  }
  if (
    !ritual &&
    pctUntilStart != null &&
    pctUntilStart > LOCAL_CONFIG.ritual.CANCEL_FREE_THRESHOLD_PCT
  ) {
    const badge = await awardNazikIptalBadge(userId, ritualId);
    return { kind: 'none', reason: 'early_cancel', badge };
  }
  if (pctUntilStart == null && hoursUntilStart != null && hoursUntilStart >= 6) {
    const badge = await awardNazikIptalBadge(userId, ritualId);
    return { kind: 'none', reason: 'early_cancel_legacy', badge };
  }

  const prior = await countRollingStrikes(userId, 'late_cancel');
  const strike = prior + 1;
  const penalty = getLateCancelRsPenalty(strike);
  if (penalty == null) {
    await afterLateCancelPenalty(userId, ritualId, strike, null);
    return { kind: 'warning', strike };
  }

  const result = await applyDirectPenalty(userId, ritualId, penalty, 'late_cancel');
  await afterLateCancelPenalty(userId, ritualId, strike, result.delta);
  return { ...result, strike };
}

/**
 * son-part.md §7.3 — host no-show: katılımcıyla aynı RS + host-ban
 */
export async function recordHostNoShowEvent(userId, ritualId) {
  const prior = await countRollingStrikes(userId, 'host_no_show');
  const strike = prior + 1;
  const penalty = getNoShowRsPenalty(strike);
  const ritualResult = await pool.query('SELECT title FROM rituals WHERE id = $1', [ritualId]);
  const ritualTitle = ritualResult.rows[0]?.title || 'Ritual';

  await notifyNoShowWarning(userId, {
    ritual_id: ritualId,
    ritual_title: ritualTitle,
    attempt: `${strike}. (host)`,
    penalty: penalty != null ? `${penalty}` : 'host cezası',
  });

  let result = { kind: 'warning', strike };
  if (penalty != null) {
    result = await applyDirectPenalty(userId, ritualId, penalty, 'host_no_show');
  }
  await afterHostNoShowPenalty(userId, ritualId, strike, result.delta ?? null);
  return { ...result, strike };
}

async function awardNazikIptalBadge(userId, ritualId) {
  try {
    const insertResult = await pool.query(
      `INSERT INTO user_badges (user_id, badge_key, badge_label, source_ritual_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, badge_key) DO NOTHING
       RETURNING id, badge_key, badge_label, awarded_at`,
      [userId, NAZIK_IPTAL_BADGE_KEY, NAZIK_IPTAL_BADGE_LABEL, ritualId]
    );

    if (insertResult.rows.length > 0) {
      await notifyBadgeEarned(userId, {
        ritual_id: ritualId,
        badge_label: insertResult.rows[0].badge_label,
        condition: 'Erken iptal (%25+ kala)',
      });
      return {
        awarded: true,
        key: insertResult.rows[0].badge_key,
        label: insertResult.rows[0].badge_label,
        awardedAt: insertResult.rows[0].awarded_at,
      };
    }

    const existing = await pool.query(
      `SELECT badge_key, badge_label, awarded_at
       FROM user_badges
       WHERE user_id = $1 AND badge_key = $2
       LIMIT 1`,
      [userId, NAZIK_IPTAL_BADGE_KEY]
    );

    if (existing.rows.length > 0) {
      return {
        awarded: false,
        key: existing.rows[0].badge_key,
        label: existing.rows[0].badge_label,
        awardedAt: existing.rows[0].awarded_at,
      };
    }
  } catch (e) {
    if (e.code !== '42P01') {
      console.error('awardNazikIptalBadge failed:', e.message);
    }
  }

  return null;
}

async function applyDirectPenalty(userId, ritualId, delta, bypassReason) {
  const cappedDelta = Math.max(delta, -LOCAL_CONFIG.rs.BYPASS_CAP_NEG);
  const u = await pool.query('SELECT rs_score FROM users WHERE id = $1', [userId]);
  if (u.rows.length === 0) throw new Error('User not found');
  const oldRS = parseFloat(u.rows[0].rs_score) || 5.0;
  const newRS = Math.max(1.0, Math.min(10.0, oldRS + cappedDelta));

  await pool.query(
    'UPDATE users SET rs_score = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
    [newRS, userId]
  );

  try {
    await pool.query(
      `INSERT INTO rs_history (user_id, old_rs, new_rs, source, ritual_id)
       VALUES ($1, $2, $3, 'bypass', $4)`,
      [userId, oldRS, newRS, ritualId]
    );
  } catch (e) {
    if (e.code !== '42P01') console.error('rs_history insert failed:', e.message);
  }

  try {
    await pool.query(
      `INSERT INTO rs_delta_history (
        user_id, ritual_id, delta, delta_before_bc3, old_rs, new_rs,
        pipeline_kind, bypass_reason
      ) VALUES ($1, $2, $3, $3, $4, $5, 'lte3_bypass', $6)`,
      [userId, ritualId, cappedDelta, oldRS, newRS, bypassReason]
    );
  } catch (e) {
    console.error('rs_delta_history bypass insert failed:', e.message);
  }

  await logScoreEvent({
    userId,
    ritualId,
    eventType: 'rs_bypass',
    delta: cappedDelta,
    inputs: { bypass_reason: bypassReason },
    breakdown: { old_rs: oldRS, new_rs: newRS },
  });

  try {
    await pool.query(
      `INSERT INTO rs_transactions (
         user_id, ritual_id, delta, rs_before, rs_after, transaction_type, bypass_reason
       ) VALUES ($1, $2, $3, $4, $5, 'bypass', $6)`,
      [userId, ritualId, cappedDelta, oldRS, newRS, bypassReason]
    );
  } catch (e) {
    if (e.code !== '42P01') {
      console.error('rs_transactions bypass insert failed:', e.message);
    }
  }

  return { kind: 'penalty', delta: cappedDelta, old_rs: oldRS, new_rs: newRS, bypassReason };
}

export { isFreeCancelWindow };
