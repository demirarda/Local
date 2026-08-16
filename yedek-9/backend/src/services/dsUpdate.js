import pool from '../config/database.js';
import { updateDsForUser, getPrivateDsDashboard } from './dsEngine.js';

export { updateDsForUser, getPrivateDsDashboard };

export async function enqueueDsUpdatesForRitualParticipants(ritualId, enqueue) {
  if (!ritualId || typeof enqueue !== 'function') {
    return { skipped: true, reason: 'missing_input' };
  }

  const participants = await pool.query(
    `SELECT DISTINCT user_id
     FROM ritual_attendance
     WHERE ritual_id = $1
       AND status::text NOT IN ('no_show', 'cancelled')`,
    [ritualId]
  );

  let scheduled = 0;
  for (const row of participants.rows) {
    await enqueue(
      'ds-update',
      { user_id: row.user_id, ritual_id: ritualId },
      { priority: 6, jobId: `ds-update:${ritualId}:${row.user_id}` }
    );
    scheduled += 1;
  }

  return { ritual_id: ritualId, scheduled };
}
