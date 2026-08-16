/**
 * Live Activity payload — son-part.md §8.4
 * Client (ActivityKit / Android Live Updates) timer render eder; backend push gunceller.
 */
import pool from '../config/database.js';
import LOCAL_CONFIG from '../config/localConfig.js';
import {
  getLifecyclePhase,
  getDurationEndDate,
  getWindowEndDate,
  RITUAL_STATUS,
} from './ritualState.js';
import { pushLiveActivityUpdate } from './notifications.js';

const { UPDATE_INTERVAL_SEC, BRAND_MARK } = LOCAL_CONFIG.liveActivity;

export function buildLiveActivityPayload(ritual, now = new Date()) {
  const phase = getLifecyclePhase(ritual, now);
  if (!LOCAL_CONFIG.liveActivity.PHASES.includes(phase)) {
    return { active: false, phase, ritual_id: ritual.id };
  }

  let endsAt;
  if (phase === RITUAL_STATUS.PRELOBBY) {
    endsAt = new Date(ritual.start_time);
  } else if (phase === RITUAL_STATUS.LIVE) {
    endsAt = getDurationEndDate(ritual);
  } else {
    endsAt = getWindowEndDate(ritual);
  }

  const remainingSeconds = Math.max(0, Math.floor((endsAt.getTime() - now.getTime()) / 1000));

  return {
    active: remainingSeconds > 0,
    ritual_id: ritual.id,
    title: ritual.title,
    phase,
    brand_mark: BRAND_MARK,
    ends_at: endsAt.toISOString(),
    remaining_seconds: remainingSeconds,
    update_interval_sec: UPDATE_INTERVAL_SEC,
  };
}

export async function getLiveActivityForUser(userId, ritualId) {
  const att = await pool.query(
    `SELECT 1 FROM ritual_attendance
     WHERE ritual_id = $1 AND user_id = $2 AND status NOT IN ('no_show', 'cancelled')
     LIMIT 1`,
    [ritualId, userId]
  );
  if (att.rows.length === 0) {
    return { ok: false, status: 403, error: 'Not attending this ritual' };
  }
  const ritualR = await pool.query(`SELECT * FROM rituals WHERE id = $1`, [ritualId]);
  if (ritualR.rows.length === 0) return { ok: false, status: 404, error: 'Ritual not found' };

  const payload = buildLiveActivityPayload(ritualR.rows[0]);
  const sessionR = await pool.query(
    `SELECT id, started_at, ended_at, platform FROM live_activity_sessions
     WHERE user_id = $1 AND ritual_id = $2 AND ended_at IS NULL
     LIMIT 1`,
    [userId, ritualId]
  );

  return {
    ok: true,
    payload,
    session: sessionR.rows[0] || null,
  };
}

export async function startLiveActivitySession(userId, ritualId, platform = 'unknown') {
  const check = await getLiveActivityForUser(userId, ritualId);
  if (!check.ok) return check;
  if (!check.payload.active) {
    return { ok: false, status: 400, error: 'Ritual is not in a live-activity phase' };
  }

  const r = await pool.query(
    `INSERT INTO live_activity_sessions (user_id, ritual_id, platform)
     VALUES ($1,$2,$3)
     ON CONFLICT (user_id, ritual_id) DO UPDATE
       SET ended_at = NULL, platform = EXCLUDED.platform, started_at = NOW()
     RETURNING *`,
    [userId, ritualId, platform]
  );

  await pushLiveActivityUpdate(userId, check.payload).catch(() => {});
  return { ok: true, session: r.rows[0], payload: check.payload };
}

export async function endLiveActivitySession(userId, ritualId) {
  const r = await pool.query(
    `UPDATE live_activity_sessions
     SET ended_at = NOW()
     WHERE user_id = $1 AND ritual_id = $2 AND ended_at IS NULL
     RETURNING *`,
    [userId, ritualId]
  );
  if (r.rows.length === 0) return { ok: false, status: 404, error: 'No active session' };
  return { ok: true, session: r.rows[0] };
}

export async function pushLiveActivityUpdatesForActiveSessions() {
  const sessions = await pool.query(
    `SELECT s.user_id, s.ritual_id, s.last_push_at, r.*
     FROM live_activity_sessions s
     JOIN rituals r ON r.id = s.ritual_id
     WHERE s.ended_at IS NULL`
  );

  let pushed = 0;
  const now = Date.now();
  for (const row of sessions.rows) {
    const lastPush = row.last_push_at ? new Date(row.last_push_at).getTime() : 0;
    if (now - lastPush < UPDATE_INTERVAL_SEC * 1000) continue;

    const payload = buildLiveActivityPayload(row);
    if (!payload.active) {
      await pool.query(
        `UPDATE live_activity_sessions SET ended_at = NOW() WHERE user_id = $1 AND ritual_id = $2`,
        [row.user_id, row.ritual_id]
      );
      continue;
    }

    await pushLiveActivityUpdate(row.user_id, payload).catch(() => {});
    await pool.query(
      `UPDATE live_activity_sessions SET last_push_at = NOW() WHERE user_id = $1 AND ritual_id = $2`,
      [row.user_id, row.ritual_id]
    );
    pushed += 1;
  }
  return { pushed, sessions: sessions.rows.length };
}
