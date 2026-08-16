import pool from '../config/database.js';
import { notifyRitualLive, notifyWindowOpened, notifyFeedbackAvailable, notifyCheckinOpen, notifyVenueRitualStarted, notifyVenueRitualEnded, notifyVenueManagers } from './notifications.js';
import { enqueue } from './queueSystem.js';
import { closeCheckinDoorsForLiveRituals } from './checkinService.js';
import { RITUAL_STATUS, computeWindowEndsAt } from './ritualState.js';
import LOCAL_CONFIG, { liveWindowHoursSqlDefault } from '../config/localConfig.js';
import { ensureCheckinCodeAtStart } from './checkinService.js';

/** @deprecated use transitionLiveToWindow */
export async function completeRitual(ritualId) {
  return transitionLiveToWindow(ritualId);
}

/**
 * PRELOBBY → LIVE when start_at reached (duration not ended)
 */
export async function checkAndStartRituals() {
  try {
    const now = new Date();
    const candidates = await pool.query(
      `SELECT r.id, r.title, r.host_id, r.venue_id, r.zone_id, v.name AS venue_name,
              z.name AS zone_name, u.city AS host_city
       FROM rituals r
       JOIN users u ON r.host_id = u.id
       LEFT JOIN venues v ON v.id = r.venue_id
       LEFT JOIN zones z ON z.id = r.zone_id
       WHERE r.status::text IN ('prelobby', 'active')
         AND r.start_time <= $1
         AND (r.start_time + (COALESCE(r.duration, 60) || ' minutes')::interval) > $1`,
      [now]
    );

    for (const row of candidates.rows) {
      await markRitualAsLive(row.id);
      await ensureCheckinCodeAtStart(row.id).catch((error) =>
        console.warn('ensureCheckinCodeAtStart failed', row.id, error.message)
      );
      await notifyRitualLiveForCity(row);
      await notifyParticipantsCheckinOpen(row);
      if (row.zone_id) {
        try {
          const { notifyZoneLiveness } = await import('./notifications.js');
          await notifyZoneLiveness(row.zone_id, {
            ritualId: row.id,
            ritualTitle: row.title,
            zoneName: row.zone_name,
          }).catch(() => {});
        } catch (_e) {
          /* non-fatal */
        }
      }
      if (row.venue_id) {
        const notified = await pool.query(
          `UPDATE rituals SET venue_ritual_start_notified_at = NOW()
           WHERE id = $1 AND venue_ritual_start_notified_at IS NULL
           RETURNING id`,
          [row.id]
        );
        if (notified.rows.length > 0) {
          await notifyVenueManagers(
            row.venue_id,
            notifyVenueRitualStarted,
            {
              venueId: row.venue_id,
              venueName: row.venue_name,
              ritualId: row.id,
              ritualTitle: row.title,
            }
          );
        }
      }
    }

    return candidates.rows.length;
  } catch (error) {
    console.error('Error in checkAndStartRituals:', error);
    return 0;
  }
}

async function notifyRitualLiveForCity(row) {
  const hostCity = row.host_city || '';
  const ritualData = { id: row.id, title: row.title };

  const usersToNotify = await pool.query(
    `SELECT us.id AS user_id FROM users us
     LEFT JOIN user_settings s ON s.user_id = us.id
     WHERE us.city = $1
       AND (s.notify_ritual_live IS NULL OR s.notify_ritual_live = true)`,
    [hostCity]
  );

  for (const u of usersToNotify.rows) {
    if (u.user_id && u.user_id !== row.host_id) {
      await notifyRitualLive(u.user_id, ritualData).catch((err) =>
        console.warn('notifyRitualLive failed', u.user_id, err.message)
      );
    }
  }
}

async function notifyParticipantsCheckinOpen(row) {
  const ritualData = { id: row.id, title: row.title };
  const participants = await pool.query(
    `SELECT user_id FROM ritual_attendance
     WHERE ritual_id = $1 AND status::text NOT IN ('no_show', 'cancelled')`,
    [row.id]
  );
  for (const p of participants.rows) {
    await notifyCheckinOpen(p.user_id, ritualData).catch(() => {});
  }
}

/**
 * LIVE → WINDOW when duration ends
 */
export async function checkAndTransitionLiveToWindow() {
  try {
    const now = new Date();
    const result = await pool.query(
      `UPDATE rituals r
       SET status = 'window',
           window_ends_at = COALESCE(
             r.window_ends_at,
             r.start_time
               + (COALESCE(r.duration, 60)::text || ' minutes')::interval
               + (COALESCE(r.live_window_hours, ${liveWindowHoursSqlDefault()})::text || ' hours')::interval
           ),
           updated_at = CURRENT_TIMESTAMP
       WHERE r.status::text = 'live'
         AND (r.start_time + (COALESCE(r.duration, 60)::text || ' minutes')::interval) < $1
       RETURNING r.id`,
      [now]
    );

    if (result.rows.length > 0) {
      console.log(`Transitioned ${result.rows.length} ritual(s) LIVE → WINDOW`);
      for (const row of result.rows) {
        await onRitualEnteredWindow(row.id);
      }
    }

    return result.rows;
  } catch (error) {
    console.error('Error transitioning live → window:', error);
    throw error;
  }
}

/** @deprecated alias */
export async function checkAndCompleteRituals() {
  return checkAndTransitionLiveToWindow();
}

/**
 * WINDOW → ARCHIVED when window ends
 */
export async function checkAndArchiveRituals() {
  try {
    const now = new Date();
    const result = await pool.query(
      `UPDATE rituals r
       SET status = 'archived',
           updated_at = CURRENT_TIMESTAMP
       WHERE r.status::text IN ('window', 'ended')
         AND COALESCE(
           r.window_ends_at,
           r.start_time
             + (COALESCE(r.duration, 60)::text || ' minutes')::interval
             + (COALESCE(r.live_window_hours, ${liveWindowHoursSqlDefault()})::text || ' hours')::interval
         ) <= $1
       RETURNING r.id, r.window_type, r.venue_id, r.title`,
      [now]
    );

    if (result.rows.length > 0) {
      console.log(`Archived ${result.rows.length} ritual(s) WINDOW → ARCHIVED`);
      for (const row of result.rows) {
        if (!row.venue_id) continue;
        const notified = await pool.query(
          `UPDATE rituals SET venue_ritual_end_notified_at = NOW()
           WHERE id = $1 AND venue_ritual_end_notified_at IS NULL
           RETURNING id`,
          [row.id]
        );
        if (notified.rows.length > 0) {
          const venueR = await pool.query(`SELECT name FROM venues WHERE id = $1`, [row.venue_id]);
          await notifyVenueManagers(
            row.venue_id,
            notifyVenueRitualEnded,
            {
              venueId: row.venue_id,
              venueName: venueR.rows[0]?.name,
              ritualId: row.id,
              ritualTitle: row.title,
            }
          );
          try {
            const { notifyNightReportMiniSignal } = await import('./notifications.js');
            await notifyVenueManagers(
              row.venue_id,
              notifyNightReportMiniSignal,
              {
                venueId: row.venue_id,
                ritualId: row.id,
                ritualTitle: row.title,
              }
            );
          } catch (_e) {
            /* best effort */
          }
        }
      }
    }

    return result.rows;
  } catch (error) {
    console.error('Error archiving rituals:', error);
    throw error;
  }
}

async function onRitualEnteredWindow(ritualId) {
  // sonMD UNDER_MIN: skor-izolasyonu / 0-mühür hard-delete
  try {
    const { applyUnderMinOnWindowEntry } = await import('./underMinGate.js');
    const gate = await applyUnderMinOnWindowEntry(ritualId);
    if (!gate.proceed) {
      if (gate.classification?.mode === 'hard_delete') {
        console.log(`Ritual ${ritualId} hard-deleted (0 seal)`);
        return { under_min: true, deleted: true };
      }
      // under_min: private window — notify window open only, no FB/RS/DS
      const ritualMeta = await pool.query(
        `SELECT id, title FROM rituals WHERE id = $1`,
        [ritualId]
      );
      const ritualData = ritualMeta.rows[0] || { id: ritualId };
      const participants = await pool.query(
        `SELECT DISTINCT user_id
         FROM ritual_attendance
         WHERE ritual_id = $1
           AND status::text NOT IN ('no_show', 'cancelled')`,
        [ritualId]
      );
      for (const p of participants.rows) {
        await notifyWindowOpened(p.user_id, {
          ...ritualData,
          under_min: true,
          private_window: true,
        }).catch(() => {});
      }
      console.log(
        `Ritual ${ritualId} UNDER_MIN (seal=${gate.classification.seal_count} < min=${gate.classification.min}) — pipeline skipped`
      );
      return { under_min: true, classification: gate.classification };
    }
  } catch (e) {
    console.warn('underMin gate', e.message);
  }

  const feedbackFloorMs = LOCAL_CONFIG.ritual.FEEDBACK_FLOOR_HOURS * 3600000;
  const ritualMeta = await pool.query(
    `SELECT id, title FROM rituals WHERE id = $1`,
    [ritualId]
  );
  const ritualData = ritualMeta.rows[0] || { id: ritualId };
  try {
    await enqueue(
      'feedback-deadline',
      { ritual_id: ritualId },
      {
        priority: 4,
        delay: feedbackFloorMs,
        jobId: `feedback-deadline:${ritualId}`,
      }
    );
  } catch (e) {
    console.warn('enqueue feedback-deadline', e.message);
  }

  const participants = await pool.query(
    `SELECT DISTINCT user_id
     FROM ritual_attendance
     WHERE ritual_id = $1
       AND status::text NOT IN ('no_show', 'cancelled')`,
    [ritualId]
  );

  for (const p of participants.rows) {
    try {
      await notifyWindowOpened(p.user_id, ritualData).catch(() => {});
      await notifyFeedbackAvailable(p.user_id, ritualData).catch(() => {});
      await enqueue(
        'ds-update',
        { user_id: p.user_id, ritual_id: ritualId },
        { priority: 6, jobId: `ds-update:${ritualId}:${p.user_id}` }
      );
    } catch (e) {
      console.warn('enqueue ds-update', e.message);
    }
  }
  return { under_min: false };
}

/** Host ends duration early → WINDOW */
export async function transitionLiveToWindow(ritualId) {
  const ritualRow = await pool.query(
    `SELECT id, start_time, duration, live_window_hours, window_ends_at
     FROM rituals WHERE id = $1`,
    [ritualId]
  );
  if (ritualRow.rows.length === 0) {
    throw new Error('Ritual not found');
  }

  const ritual = ritualRow.rows[0];
  const windowEnds = computeWindowEndsAt(ritual);

  await pool.query(
    `UPDATE rituals
     SET status = 'window',
         window_ends_at = $2,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [ritualId, windowEnds]
  );

  await onRitualEnteredWindow(ritualId);

  return { success: true, ritualId, status: RITUAL_STATUS.WINDOW, window_ends_at: windowEnds };
}

export async function checkAndCloseCheckinDoors() {
  try {
    const result = await closeCheckinDoorsForLiveRituals();
    if (result.marked > 0) {
      console.log(`Door close: marked ${result.marked} participant(s) as no-show`);
    }
    return result;
  } catch (error) {
    console.error('Error closing check-in doors:', error);
    throw error;
  }
}

export async function markRitualAsLive(ritualId) {
  try {
    await pool.query(
      `UPDATE rituals SET status = 'live', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [ritualId]
    );
    console.log(`Ritual ${ritualId} marked as live`);
    return { success: true, ritualId };
  } catch (error) {
    console.error('Error marking ritual as live:', error);
    throw error;
  }
}
