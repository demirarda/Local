import pool from '../config/database.js';
import { enqueue } from './queueSystem.js';
import { applyFriendshipLevelOnCheckin } from './friendshipLevel.js';

/** Post check-in side effects (FL, badges, regular, zone points). */
export async function runPostCheckinJobs(ritualId, userId) {
  let flUpdate = null;
  try {
    await enqueue('fl-update', { ritual_id: ritualId, user_id: userId }, { priority: 5 });
    flUpdate = { queued: true };
  } catch (_e) {
    try {
      flUpdate = await applyFriendshipLevelOnCheckin(ritualId, userId);
    } catch (_ee) {
      // best effort
    }
  }
  try {
    await enqueue('badge-evaluation', { ritual_id: ritualId }, { priority: 5 });
  } catch (_e) {
    // best effort
  }
  try {
    const venueR = await pool.query(`SELECT venue_id FROM rituals WHERE id = $1`, [ritualId]);
    const venueId = venueR.rows[0]?.venue_id;
    if (venueId) {
      const { afterVenueCheckin } = await import('./regularService.js');
      await afterVenueCheckin({ userId, venueId });
      const { grantVenueBadgeIfEarned } = await import('./venueBadgeService.js');
      await grantVenueBadgeIfEarned(userId, venueId, { ritualId }).catch(() => {});
    }
    const { awardZoneRitualPoints } = await import('./zoneBadgeSignalService.js');
    await awardZoneRitualPoints(userId, ritualId).catch(() => {});
  } catch (_e) {
    // best effort
  }
  return flUpdate;
}
