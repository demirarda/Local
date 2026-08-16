/**
 * sonMD §2D birth_cancel — Instant + age≤BIRTH_CANCEL_MIN + seal_count==1(kuran)
 * → hard-delete, log-only. Panel [yer veremedik] same silent path + neutral push.
 */
import pool from '../config/database.js';
import LOCAL_CONFIG from '../config/localConfig.js';
import { countSealedAtRitual } from './firstSealService.js';
import { hardDeleteZeroSealRitual } from './underMinGate.js';
import { logAdminAction } from '../utils/auditLog.js';

function isInstantRitual(ritual) {
  const tt = String(ritual?.time_type || '').toLowerCase();
  return tt === 'instant';
}

/**
 * @returns {Promise<{ ok: boolean, eligible: boolean, reason?: string, ritual?: object, seal_count?: number, age_min?: number }>}
 */
export async function evaluateBirthCancel(ritualId, actorId = null) {
  const r = await pool.query(
    `SELECT id, host_id, title, status, time_type, origin, venue_id, created_at, start_time
     FROM rituals WHERE id = $1`,
    [ritualId]
  );
  if (!r.rows[0]) return { ok: false, eligible: false, reason: 'not_found', status: 404 };
  const ritual = r.rows[0];
  if (String(ritual.status) === 'cancelled') {
    return { ok: true, eligible: false, reason: 'already_cancelled', ritual };
  }
  if (!isInstantRitual(ritual)) {
    return { ok: true, eligible: false, reason: 'not_instant', ritual };
  }
  const maxMin = Number(LOCAL_CONFIG.ritual?.BIRTH_CANCEL_MIN ?? 10);
  const created = ritual.created_at ? new Date(ritual.created_at).getTime() : 0;
  const ageMin = created ? (Date.now() - created) / 60000 : Infinity;
  if (ageMin > maxMin) {
    return { ok: true, eligible: false, reason: 'too_old', ritual, age_min: ageMin, max_min: maxMin };
  }
  const seal_count = await countSealedAtRitual(ritualId);
  if (seal_count !== 1) {
    return { ok: true, eligible: false, reason: 'seal_count', ritual, seal_count };
  }
  if (actorId != null && String(ritual.host_id) !== String(actorId)) {
    return { ok: false, eligible: false, reason: 'not_creator', status: 403, ritual, seal_count };
  }
  return { ok: true, eligible: true, ritual, seal_count, age_min: ageMin, max_min: maxMin };
}

/**
 * Host birth-cancel: hard-delete when eligible.
 */
export async function birthCancelAsHost({ ritualId, hostId }) {
  const gate = await evaluateBirthCancel(ritualId, hostId);
  if (!gate.ok) {
    return { ok: false, status: gate.status || 400, error: gate.reason || 'birth_cancel_denied', code: 'BIRTH_CANCEL_DENIED' };
  }
  if (!gate.eligible) {
    return { ok: false, status: 400, error: 'Not eligible for birth cancel', code: 'BIRTH_CANCEL_INELIGIBLE', detail: gate };
  }

  const deleted = await hardDeleteZeroSealRitual(ritualId);
  await logAdminAction(pool, {
    adminUserId: hostId,
    action: 'birth_cancel',
    targetType: 'ritual',
    targetId: ritualId,
    details: {
      title: gate.ritual.title,
      seal_count: gate.seal_count,
      age_min: gate.age_min,
      hard_deleted: deleted.deleted === true,
    },
  });

  return {
    ok: true,
    mode: deleted.deleted ? 'hard_deleted' : 'soft_cancelled',
    penalty_free: true,
    ritual: gate.ritual,
  };
}

/**
 * Venue panel [yer veremedik] — walk-in live card silent cancel.
 * Prefer birth hard-delete when eligible; else soft-cancel without city fanout.
 */
export async function venueNoCapacityCancel({ venueId, ritualId, managerId }) {
  const mgr = await pool.query(
    `SELECT 1 FROM venue_managers WHERE venue_id = $1 AND user_id = $2 LIMIT 1`,
    [venueId, managerId]
  );
  if (mgr.rows.length === 0) {
    return { ok: false, status: 403, error: 'Venue staff only', code: 'VENUE_STAFF_ONLY' };
  }

  const r = await pool.query(
    `SELECT id, host_id, title, status, time_type, origin, venue_id, created_at, start_time
     FROM rituals WHERE id = $1`,
    [ritualId]
  );
  if (!r.rows[0]) return { ok: false, status: 404, error: 'Ritual not found' };
  const ritual = r.rows[0];
  if (String(ritual.venue_id) !== String(venueId)) {
    return { ok: false, status: 404, error: 'Ritual not found for this venue' };
  }
  const origin = String(ritual.origin || '').toUpperCase();
  if (origin !== 'WALK_IN') {
    return { ok: false, status: 400, error: 'Only walk-in rituals', code: 'NOT_WALK_IN' };
  }
  if (String(ritual.status) === 'cancelled') {
    return { ok: true, already: true, mode: 'already_cancelled', ritual };
  }

  const birth = await evaluateBirthCancel(ritualId, ritual.host_id);
  if (birth.eligible) {
    const deleted = await hardDeleteZeroSealRitual(ritualId);
    await logAdminAction(pool, {
      adminUserId: managerId,
      action: 'yer_veremedik',
      targetType: 'ritual',
      targetId: ritualId,
      details: { venue_id: venueId, mode: 'hard_deleted', host_id: ritual.host_id },
    });
    return {
      ok: true,
      mode: deleted.deleted ? 'hard_deleted' : 'soft_cancelled',
      notify_host: true,
      ritual,
      penalty_free: true,
    };
  }

  await pool.query(
    `UPDATE rituals
     SET status = 'cancelled',
         cancel_reason = 'yer_veremedik',
         cancelled_at = NOW(),
         updated_at = NOW()
     WHERE id = $1`,
    [ritualId]
  );
  await logAdminAction(pool, {
    adminUserId: managerId,
    action: 'yer_veremedik',
    targetType: 'ritual',
    targetId: ritualId,
    details: { venue_id: venueId, mode: 'soft_cancelled', host_id: ritual.host_id },
  });
  return {
    ok: true,
    mode: 'soft_cancelled',
    notify_host: true,
    ritual: { ...ritual, cancel_reason: 'yer_veremedik' },
    penalty_free: true,
  };
}
