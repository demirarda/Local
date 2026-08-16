/**
 * NOTIF §11 — zamanlanmis Ritual bildirimleri
 */
import pool from '../config/database.js';
import LOCAL_CONFIG from '../config/localConfig.js';
import { getDoorCloseTime } from './checkinService.js';
import {
  notifyCheckinOpen,
  notifyDoorClosing,
  notifyExactDetailsUnlocked,
  notifyFeedbackClosing,
  notifyPenaltySuspensionEnd,
  notifyPenaltyHostBanEnd,
} from './notifications.js';

/** Grace biten katilimcilara exact detay ac + bildir */
export async function processPrelobbyGraceUnlocks() {
  const rows = await pool.query(
    `SELECT ra.id, ra.user_id, ra.ritual_id, r.title
     FROM ritual_attendance ra
     JOIN rituals r ON r.id = ra.ritual_id
     WHERE ra.status::text NOT IN ('no_show', 'cancelled')
       AND ra.prelobby_grace_ends_at IS NOT NULL
       AND ra.prelobby_grace_ends_at <= NOW()
       AND ra.exact_details_notified_at IS NULL
       AND r.status::text IN ('prelobby', 'active', 'live')`
  );

  let notified = 0;
  for (const row of rows.rows) {
    const now = new Date();
    await pool.query(
      `UPDATE ritual_attendance
       SET exact_details_unlocked_at = $2,
           exact_details_notified_at = $2
       WHERE id = $1`,
      [row.id, now]
    );
    await notifyExactDetailsUnlocked(row.user_id, { id: row.ritual_id, title: row.title }).catch(() => {});
    notified += 1;
  }
  return { notified };
}

/** Kapı kapanmadan ~5 dk once check-in yapmayanlara uyar */
export async function processDoorClosingWarnings() {
  const rituals = await pool.query(
    `SELECT id, title, start_time, duration, door_closing_notified_at
     FROM rituals
     WHERE status::text = 'live'
       AND door_closing_notified_at IS NULL
       AND start_time <= NOW()`
  );

  let notified = 0;
  const now = new Date();
  for (const r of rituals.rows) {
    const doorClose = getDoorCloseTime(r.start_time, r.duration);
    const warnAt = new Date(doorClose.getTime() - 5 * 60000);
    if (now < warnAt || now > doorClose) continue;

    const unchecked = await pool.query(
      `SELECT user_id FROM ritual_attendance
       WHERE ritual_id = $1
         AND checkin_at IS NULL
         AND status::text = 'confirmed'`,
      [r.id]
    );

    const ritualData = { id: r.id, title: r.title };
    for (const p of unchecked.rows) {
      await notifyDoorClosing(p.user_id, ritualData).catch(() => {});
      notified += 1;
    }

    await pool.query(
      `UPDATE rituals SET door_closing_notified_at = NOW() WHERE id = $1`,
      [r.id]
    );
  }
  return { notified };
}

/** Feedback kapanis uyarisi — window bitisinden 6 saat once */
export async function processFeedbackClosingWarnings() {
  const floorH = LOCAL_CONFIG.ritual.FEEDBACK_FLOOR_HOURS;
  const warnBeforeH = 6;
  const rows = await pool.query(
    `SELECT r.id AS ritual_id, r.title, ra.user_id
     FROM rituals r
     JOIN ritual_attendance ra ON ra.ritual_id = r.id
     WHERE ra.status::text NOT IN ('no_show', 'cancelled')
       AND r.status::text IN ('window', 'ended', 'archived', 'closed')
       AND (
         r.start_time
         + (COALESCE(r.duration, 60)::text || ' minutes')::interval
         + ($1::text || ' hours')::interval
       ) <= NOW()
       AND (
         r.start_time
         + (COALESCE(r.duration, 60)::text || ' minutes')::interval
         + ($1::text || ' hours')::interval
       ) > NOW() - INTERVAL '2 minutes'`,
    [String(floorH - warnBeforeH)]
  );

  let notified = 0;
  for (const row of rows.rows) {
    await notifyFeedbackClosing(row.user_id, { id: row.ritual_id, title: row.title }).catch(() => {});
    notified += 1;
  }
  return { notified };
}

/** E Ceza — aski / host-ban bitisi bildirimi */
export async function processPenaltyEndNotifications() {
  const suspensionRows = await pool.query(
    `SELECT id FROM users
     WHERE penalty_suspended_until IS NOT NULL
       AND penalty_suspended_until <= NOW()
       AND penalty_suspended_until > NOW() - INTERVAL '3 minutes'
       AND (
         penalty_suspension_end_notified_at IS NULL
         OR penalty_suspension_end_notified_at < penalty_suspended_until
       )`
  );

  let notified = 0;
  for (const row of suspensionRows.rows) {
    await notifyPenaltySuspensionEnd(row.id).catch(() => {});
    await pool.query(
      `UPDATE users SET penalty_suspension_end_notified_at = NOW() WHERE id = $1`,
      [row.id]
    );
    notified += 1;
  }

  const banRows = await pool.query(
    `SELECT id FROM users
     WHERE host_ban_until IS NOT NULL
       AND host_ban_until <= NOW()
       AND host_ban_until > NOW() - INTERVAL '3 minutes'
       AND (
         host_ban_end_notified_at IS NULL
         OR host_ban_end_notified_at < host_ban_until
       )`
  );

  for (const row of banRows.rows) {
    await notifyPenaltyHostBanEnd(row.id).catch(() => {});
    await pool.query(
      `UPDATE users SET host_ban_end_notified_at = NOW() WHERE id = $1`,
      [row.id]
    );
    notified += 1;
  }

  return { notified };
}
