/**
 * Venue arsiv NOTIF — §9.5 / §11-F
 */
import pool from '../config/database.js';
import { PUBLIC_ARCHIVE_SQL } from './venueArchiveService.js';
import { notifyVenueMemoryArchived } from './notifications.js';

export async function onMemoryCreatedForVenue({ memoryId, ritualId, userId }) {
  if (!ritualId || !memoryId) return { skipped: true };

  const r = await pool.query(
    `SELECT r.venue_id, v.name AS venue_name
     FROM rituals r
     LEFT JOIN venues v ON v.id = r.venue_id
     WHERE r.id = $1 AND r.venue_id IS NOT NULL`,
    [ritualId]
  );
  if (r.rows.length === 0) return { skipped: true, reason: 'no_venue' };

  const mem = await pool.query(
    `SELECT m.id FROM memories m WHERE m.id = $1 AND ${PUBLIC_ARCHIVE_SQL}`,
    [memoryId]
  );
  if (mem.rows.length === 0) return { skipped: true, reason: 'not_public_archive' };

  const { venue_id: venueId, venue_name: venueName } = r.rows[0];
  const managers = await pool.query(
    `SELECT user_id FROM venue_managers WHERE venue_id = $1`,
    [venueId]
  );

  for (const m of managers.rows) {
    if (m.user_id === userId) continue;
    notifyVenueMemoryArchived(m.user_id, { venueId, venueName, memoryId }).catch(() => {});
  }
  return { notified_managers: managers.rows.length };
}
