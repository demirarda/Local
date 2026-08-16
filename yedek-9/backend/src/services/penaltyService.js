/**
 * Cezalar, askı, host-ban, rolling 30g — son-part.md §7
 */
import pool from '../config/database.js';
import LOCAL_CONFIG, {
  getHostBanConfig,
  getNoShowSuspensionHours,
  isFreeCancelWindow,
  isWithinJoinGrace,
  requiresReplacement,
} from '../config/localConfig.js';
import { enqueue } from './queueSystem.js';
import {
  notifyPenaltyWarning,
  notifyPenaltySuspension,
  notifyPenaltyHostBan,
  notifyReplacementInvite,
  notifyReplacementRequired,
} from './notifications.js';
import { promoteWaitlistBestEffort } from './waitlistService.js';
import { assertCanJoinRitualConstraints } from './ritualState.js';

const ROLLING_DAYS = LOCAL_CONFIG.penalties.ROLLING_DAYS;

export {
  isFreeCancelWindow,
  isWithinJoinGrace,
  requiresReplacement,
};

export async function getUserPenaltyStatus(userId) {
  const r = await pool.query(
    `SELECT penalty_suspended_until, host_ban_until, suspended_at
     FROM users WHERE id = $1`,
    [userId]
  );
  if (r.rows.length === 0) return null;
  const row = r.rows[0];
  const now = new Date();
  return {
    penalty_suspended_until: row.penalty_suspended_until,
    host_ban_until: row.host_ban_until,
    admin_suspended_at: row.suspended_at,
    is_penalty_suspended:
      row.penalty_suspended_until != null && new Date(row.penalty_suspended_until) > now,
    is_host_banned: row.host_ban_until != null && new Date(row.host_ban_until) > now,
    is_admin_suspended: row.suspended_at != null,
  };
}

export async function assertCanJoinRitual(userId) {
  const status = await getUserPenaltyStatus(userId);
  if (!status) return { ok: false, code: 'USER_NOT_FOUND' };
  if (status.is_admin_suspended) {
    return { ok: false, code: 'ACCOUNT_SUSPENDED', message: 'Hesap askıda.' };
  }
  if (status.is_penalty_suspended) {
    return {
      ok: false,
      code: 'PENALTY_SUSPENDED',
      message: 'No-show askısı aktif — Rituale katılamazsın.',
      until: status.penalty_suspended_until,
    };
  }
  return { ok: true };
}

export async function assertCanHostRitual(userId) {
  const status = await getUserPenaltyStatus(userId);
  if (!status) return { ok: false, code: 'USER_NOT_FOUND' };
  if (status.is_admin_suspended) {
    return { ok: false, code: 'ACCOUNT_SUSPENDED', message: 'Hesap askıda.' };
  }
  if (status.is_penalty_suspended) {
    return {
      ok: false,
      code: 'PENALTY_SUSPENDED',
      message: 'No-show askısı aktif — Ritual açamazsın.',
      until: status.penalty_suspended_until,
    };
  }
  if (status.is_host_banned) {
    return {
      ok: false,
      code: 'HOST_BANNED',
      message: 'Host-ban aktif — Ritual açamazsın.',
      until: status.host_ban_until,
    };
  }
  try {
    const { canHostRitualMod } = await import('./modEngine.js');
    const mod = await canHostRitualMod(userId);
    if (!mod.ok) return mod;
  } catch (_e) {
    /* mod table may be missing pre-migration */
  }
  return { ok: true };
}

export async function countRollingStrikes(userId, eventType) {
  const r = await pool.query(
    `SELECT COUNT(*)::int AS c
     FROM penalty_events
     WHERE user_id = $1
       AND event_type = $2
       AND created_at > NOW() - ($3 || ' days')::interval`,
    [userId, eventType, ROLLING_DAYS]
  );
  return r.rows[0]?.c ?? 0;
}

async function syncBypassCounters(userId) {
  const [noShow, lateCancel] = await Promise.all([
    countRollingStrikes(userId, 'no_show'),
    countRollingStrikes(userId, 'late_cancel'),
  ]);
  await pool.query(
    `INSERT INTO user_rs_bypass_state (user_id, no_show_count, late_cancel_count, updated_at)
     VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
     ON CONFLICT (user_id) DO UPDATE SET
       no_show_count = EXCLUDED.no_show_count,
       late_cancel_count = EXCLUDED.late_cancel_count,
       updated_at = CURRENT_TIMESTAMP`,
    [userId, noShow, lateCancel]
  );
  return { no_show_count: noShow, late_cancel_count: lateCancel };
}

async function recordPenaltyEvent({
  userId,
  ritualId,
  eventType,
  strike,
  rsDelta = null,
  suspensionHours = null,
  hostBanHours = null,
}) {
  await pool.query(
    `INSERT INTO penalty_events (
       user_id, ritual_id, event_type, strike, rs_delta, suspension_hours, host_ban_hours
     ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [userId, ritualId, eventType, strike, rsDelta, suspensionHours, hostBanHours]
  );
  await syncBypassCounters(userId);
}

export async function applyParticipationSuspension(userId, hours) {
  if (!hours || hours <= 0) return null;
  await pool.query(
    `UPDATE users
     SET penalty_suspended_until = GREATEST(
           COALESCE(penalty_suspended_until, NOW()),
           NOW()
         ) + ($2 || ' hours')::interval,
         penalty_suspension_end_notified_at = NULL,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [userId, hours]
  );
  return { hours };
}

export async function applyHostBan(userId, strike) {
  const cfg = getHostBanConfig(strike);
  if (!cfg?.hours) return null;
  await pool.query(
    `UPDATE users
     SET host_ban_until = GREATEST(
           COALESCE(host_ban_until, NOW()),
           NOW()
         ) + ($2 || ' hours')::interval,
         host_ban_end_notified_at = NULL,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [userId, cfg.hours]
  );
  return cfg;
}

export async function getOpenReplacementSlots(ritualId) {
  const r = await pool.query(
    `SELECT id, ritual_id, vacated_by_user_id, status, expires_at, created_at
     FROM ritual_replacement_slots
     WHERE ritual_id = $1 AND status = 'open'
     ORDER BY created_at ASC`,
    [ritualId]
  );
  return r.rows;
}

export async function getOpenReplacementForUser(ritualId, userId) {
  const r = await pool.query(
    `SELECT * FROM ritual_replacement_slots
     WHERE ritual_id = $1 AND vacated_by_user_id = $2 AND status = 'open'
     LIMIT 1`,
    [ritualId, userId]
  );
  return r.rows[0] ?? null;
}

export async function createReplacementSlot(ritualId, userId, ritualStartTime) {
  const existing = await getOpenReplacementForUser(ritualId, userId);
  if (existing) return existing;

  const expiresAt = new Date(ritualStartTime);
  const r = await pool.query(
    `INSERT INTO ritual_replacement_slots (ritual_id, vacated_by_user_id, expires_at)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [ritualId, userId, expiresAt]
  );
  const slot = r.rows[0];

  const attendees = await pool.query(
    `SELECT user_id FROM ritual_attendance
     WHERE ritual_id = $1 AND user_id != $2 AND status = 'confirmed'`,
    [ritualId, userId]
  );
  for (const row of attendees.rows) {
    notifyReplacementInvite(row.user_id, { ritualId, slotId: slot.id }).catch(() => {});
  }

  return slot;
}

async function finalizeAttendanceCancel(ritualId, userId, cancellationType) {
  const result = await pool.query(
    `UPDATE ritual_attendance
     SET status = 'cancelled',
         cancelled_at = CURRENT_TIMESTAMP,
         replacement_pending = false,
         cancellation_type = $3::ritual_cancellation_type
     WHERE ritual_id = $1 AND user_id = $2
     RETURNING *`,
    [ritualId, userId, cancellationType]
  );
  promoteWaitlistBestEffort(ritualId);
  return result.rows[0] ?? null;
}

export async function cancelAttendancePenaltyFree(ritualId, userId) {
  return finalizeAttendanceCancel(ritualId, userId, 'early');
}

function durationPctUntilStart(ritual, now) {
  const start = new Date(ritual.start_time);
  const durationMin = Number(ritual.duration) || 60;
  const remainingMs = start.getTime() - now.getTime();
  if (remainingMs <= 0) return 0;
  return remainingMs / (durationMin * 60000);
}

/**
 * @returns {Promise<{ ok: boolean, status?: number, data?: object, body?: object }>}
 */
export async function processAttendanceCancel(userId, ritualId, options = {}) {
  const { force_without_replacement = false } = options;

  const ritualResult = await pool.query(
    `SELECT id, title, start_time, duration, host_id, collapsed_at
     FROM rituals WHERE id = $1`,
    [ritualId]
  );
  if (ritualResult.rows.length === 0) {
    return { ok: false, status: 404, body: { success: false, error: 'Ritual not found' } };
  }
  const ritual = ritualResult.rows[0];
  if (ritual.collapsed_at) {
    return { ok: false, status: 410, body: { success: false, error: 'Ritual collapsed' } };
  }

  const attResult = await pool.query(
    `SELECT * FROM ritual_attendance WHERE ritual_id = $1 AND user_id = $2`,
    [ritualId, userId]
  );
  if (attResult.rows.length === 0 || attResult.rows[0].status === 'cancelled') {
    return { ok: false, status: 400, body: { success: false, error: 'User is not attending this ritual' } };
  }
  const attendance = attResult.rows[0];
  const now = new Date();

  if (isWithinJoinGrace(attendance, now)) {
    const data = await finalizeAttendanceCancel(ritualId, userId, 'early');
    return {
      ok: true,
      status: 200,
      data: { attendance: data, cancel_reason: 'grace_exit', penalty: null },
    };
  }

  if (isFreeCancelWindow(ritual, now)) {
    const data = await finalizeAttendanceCancel(ritualId, userId, 'early');
    return {
      ok: true,
      status: 200,
      data: {
        attendance: data,
        cancel_reason: 'early_cancel',
        pct_until_start: durationPctUntilStart(ritual, now),
        penalty: null,
      },
    };
  }

  if (requiresReplacement(ritual, now) && !force_without_replacement) {
    const existing = await getOpenReplacementForUser(ritualId, userId);
    if (existing) {
      return {
        ok: false,
        status: 409,
        body: {
          success: false,
          error: 'Replacement pending',
          requires_replacement: true,
          replacement_slot: existing,
        },
      };
    }

    const slot = await createReplacementSlot(ritualId, userId, ritual.start_time);
    await pool.query(
      `UPDATE ritual_attendance SET replacement_pending = true
       WHERE ritual_id = $1 AND user_id = $2`,
      [ritualId, userId]
    );
    notifyReplacementRequired(userId, { ritualId, slotId: slot.id }).catch(() => {});
    return {
      ok: true,
      status: 202,
      data: {
        pending_replacement: true,
        replacement_slot: slot,
        message: 'Yer açıldı — replacement bulunursa cezasız çıkarsın.',
      },
    };
  }

  const pctUntilStart = durationPctUntilStart(ritual, now);
  const data = await finalizeAttendanceCancel(ritualId, userId, 'late');
  await pool.query(
    `UPDATE ritual_replacement_slots
     SET status = 'expired'
     WHERE ritual_id = $1 AND vacated_by_user_id = $2 AND status = 'open'`,
    [ritualId, userId]
  );

  let bypassResult = null;
  try {
    await enqueue(
      'rs-bypass',
      {
        action: 'late_cancel',
        user_id: userId,
        ritual_id: ritualId,
        pct_until_start: pctUntilStart,
      },
      { priority: 1, jobId: `rs-bypass:late_cancel:${ritualId}:${userId}` }
    );
    bypassResult = { queued: true };
  } catch (e) {
    console.warn('enqueue rs-bypass late_cancel:', e.message);
  }

  return {
    ok: true,
    status: 200,
    data: {
      attendance: data,
      cancel_reason: 'late_cancel',
      pct_until_start: pctUntilStart,
      bypass: bypassResult,
    },
  };
}

export async function claimReplacementSlot(ritualId, claimerUserId) {
  const joinCheck = await assertCanJoinRitual(claimerUserId);
  if (!joinCheck.ok) {
    return { ok: false, status: 403, body: { success: false, error: joinCheck.message, code: joinCheck.code } };
  }

  const ritualResult = await pool.query(
    `SELECT * FROM rituals WHERE id = $1`,
    [ritualId]
  );
  if (ritualResult.rows.length === 0) {
    return { ok: false, status: 404, body: { success: false, error: 'Ritual not found' } };
  }
  const ritual = ritualResult.rows[0];
  if (ritual.collapsed_at) {
    return { ok: false, status: 410, body: { success: false, error: 'Ritual collapsed' } };
  }

  const kseti = await assertCanJoinRitualConstraints(pool, claimerUserId, ritual);
  if (!kseti.ok) {
    return {
      ok: false,
      status: 422,
      body: {
        success: false,
        error: kseti.error,
        code: kseti.code,
        conflicting_ritual_id: kseti.conflicting_ritual_id,
      },
    };
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const slotResult = await client.query(
      `SELECT * FROM ritual_replacement_slots
       WHERE ritual_id = $1 AND status = 'open'
       ORDER BY created_at ASC
       LIMIT 1
       FOR UPDATE`,
      [ritualId]
    );
    if (slotResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return { ok: false, status: 404, body: { success: false, error: 'No open replacement slot' } };
    }
    const slot = slotResult.rows[0];
    if (String(slot.vacated_by_user_id) === String(claimerUserId)) {
      await client.query('ROLLBACK');
      return { ok: false, status: 400, body: { success: false, error: 'Cannot claim your own slot' } };
    }

    const existing = await client.query(
      `SELECT status FROM ritual_attendance WHERE ritual_id = $1 AND user_id = $2`,
      [ritualId, claimerUserId]
    );
    if (existing.rows.length > 0 && existing.rows[0].status !== 'cancelled') {
      await client.query('ROLLBACK');
      return { ok: false, status: 409, body: { success: false, error: 'Already attending this ritual' } };
    }

    const countResult = await client.query(
      `SELECT COUNT(*)::int AS c FROM ritual_attendance
       WHERE ritual_id = $1 AND status NOT IN ('no_show', 'cancelled')`,
      [ritualId]
    );
    if (countResult.rows[0].c >= ritual.capacity) {
      await client.query('ROLLBACK');
      return { ok: false, status: 422, body: { success: false, error: 'Ritual at capacity' } };
    }

    const vacatedUserId = slot.vacated_by_user_id;
    await client.query(
      `UPDATE ritual_attendance
       SET status = 'cancelled',
           cancelled_at = CURRENT_TIMESTAMP,
           replacement_pending = false,
           cancellation_type = 'early'::ritual_cancellation_type
       WHERE ritual_id = $1 AND user_id = $2`,
      [ritualId, vacatedUserId]
    );

    await client.query(
      `UPDATE ritual_replacement_slots
       SET status = 'filled', filled_by_user_id = $2, filled_at = NOW()
       WHERE id = $1`,
      [slot.id, claimerUserId]
    );

    const joinedAt = new Date();
    const { computePrelobbyGrace } = await import('./ritualState.js');
    const { graceEndsAt, exactDetailsUnlockedAt } = computePrelobbyGrace(
      joinedAt,
      ritual.start_time,
      ritual
    );

    let attendanceRow;
    if (existing.rows.length > 0) {
      const upd = await client.query(
        `UPDATE ritual_attendance
         SET status = 'confirmed',
             joined_at = $3,
             prelobby_grace_ends_at = $4,
             exact_details_unlocked_at = $4,
             replacement_pending = false,
             cancelled_at = NULL,
             cancellation_type = NULL,
             join_count = COALESCE(join_count, 1) + 1
         WHERE ritual_id = $1 AND user_id = $2
         RETURNING *`,
        [ritualId, claimerUserId, joinedAt, exactDetailsUnlockedAt]
      );
      attendanceRow = upd.rows[0];
    } else {
      const ins = await client.query(
        `INSERT INTO ritual_attendance (
           ritual_id, user_id, status, joined_at,
           prelobby_grace_ends_at, exact_details_unlocked_at, join_count
         ) VALUES ($1, $2, 'confirmed', $3, $4, $5, 1)
         RETURNING *`,
        [ritualId, claimerUserId, joinedAt, graceEndsAt, exactDetailsUnlockedAt]
      );
      attendanceRow = ins.rows[0];
    }

    await client.query('COMMIT');
    return {
      ok: true,
      status: 200,
      data: {
        attendance: attendanceRow,
        replacement_slot: { ...slot, status: 'filled', filled_by_user_id: claimerUserId },
        vacated_user_id: vacatedUserId,
      },
    };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function collapseRitualHostNoShow(ritualId, hostUserId) {
  await pool.query(
    `UPDATE rituals
     SET collapsed_at = NOW(),
         collapse_reason = 'host_no_show',
         status = 'archived',
         updated_at = NOW()
     WHERE id = $1 AND collapsed_at IS NULL`,
    [ritualId]
  );

  await pool.query(
    `UPDATE ritual_attendance
     SET status = 'cancelled',
         cancellation_type = 'early'::ritual_cancellation_type
     WHERE ritual_id = $1
       AND user_id != $2
       AND checkin_at IS NULL
       AND status = 'confirmed'`,
    [ritualId, hostUserId]
  );

  try {
    await enqueue(
      'rs-bypass',
      { action: 'host_no_show', user_id: hostUserId, ritual_id: ritualId },
      { priority: 1, jobId: `rs-bypass:host_no_show:${ritualId}:${hostUserId}` }
    );
  } catch (e) {
    console.warn('enqueue host_no_show:', e.message);
  }

  return { collapsed: true, ritual_id: ritualId };
}

/**
 * sonMD §4 ev — kimse mühürlemezse kapıda düşer.
 * Katılımcı cancelled (no_show değil) · host RS cezası yok.
 */
export async function collapseHomeEmptyDoor(ritualId) {
  await pool.query(
    `UPDATE rituals
     SET collapsed_at = NOW(),
         collapse_reason = 'home_empty_door',
         status = 'archived',
         updated_at = NOW()
     WHERE id = $1 AND collapsed_at IS NULL`,
    [ritualId]
  );

  await pool.query(
    `UPDATE ritual_attendance
     SET status = 'cancelled',
         cancellation_type = 'early'::ritual_cancellation_type
     WHERE ritual_id = $1
       AND checkin_at IS NULL
       AND status = 'confirmed'`,
    [ritualId]
  );

  return { collapsed: true, ritual_id: ritualId, reason: 'home_empty_door' };
}

/**
 * v2 §2 emanet — host did not open code; hosting identity unchanged, signal only.
 * Does NOT collapse the ritual (relay continues via escrow holder).
 */
export async function recordHostNoShowSignal(hostUserId, ritualId) {
  if (!hostUserId || !ritualId) return { ok: false };
  await recordPenaltyEvent({
    userId: hostUserId,
    ritualId,
    eventType: 'host_no_show',
    strike: 1,
    rsDelta: null,
  });
  try {
    await enqueue(
      'rs-bypass',
      { action: 'host_no_show_signal', user_id: hostUserId, ritual_id: ritualId },
      { priority: 2, jobId: `rs-bypass:host_no_show_signal:${ritualId}:${hostUserId}` }
    );
  } catch (e) {
    console.warn('enqueue host_no_show_signal:', e.message);
  }
  notifyPenaltyWarning(hostUserId, {
    ritualId,
    eventType: 'host_no_show',
    strike: 1,
  }).catch(() => {});
  return { ok: true, signal: true };
}

export async function afterNoShowPenalty(userId, ritualId, strike, rsDelta) {
  const suspensionHours = getNoShowSuspensionHours(strike);
  await recordPenaltyEvent({
    userId,
    ritualId,
    eventType: 'no_show',
    strike,
    rsDelta,
    suspensionHours,
  });
  notifyPenaltyWarning(userId, { ritualId, eventType: 'no_show', strike }).catch(() => {});
  if (suspensionHours) {
    await applyParticipationSuspension(userId, suspensionHours);
    notifyPenaltySuspension(userId, { ritualId, hours: suspensionHours }).catch(() => {});
  }
}

export async function afterLateCancelPenalty(userId, ritualId, strike, rsDelta) {
  await recordPenaltyEvent({
    userId,
    ritualId,
    eventType: 'late_cancel',
    strike,
    rsDelta,
  });
  notifyPenaltyWarning(userId, { ritualId, eventType: 'late_cancel', strike }).catch(() => {});
}

export async function afterHostNoShowPenalty(userId, ritualId, strike, rsDelta) {
  const cfg = getHostBanConfig(strike);
  await recordPenaltyEvent({
    userId,
    ritualId,
    eventType: 'host_no_show',
    strike,
    rsDelta,
    hostBanHours: cfg?.hours ?? null,
  });
  notifyPenaltyWarning(userId, { ritualId, eventType: 'host_no_show', strike }).catch(() => {});
  if (cfg) {
    await applyHostBan(userId, strike);
    if (cfg.hours) {
      notifyPenaltyHostBan(userId, { ritualId, hours: cfg.hours }).catch(() => {});
    }
  }
}
