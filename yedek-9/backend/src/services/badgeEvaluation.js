/**
 * Legacy wrapper — delegates to badgeEngine (F6)
 */
export {
  evaluateBadgesForRitual,
  evaluateBadgesForUser,
  syncBadgeCatalogFromConfig,
  getBadgeArchive,
  setHighlightedBadges,
} from './badgeEngine.js';

import { evaluateBadgesForUser } from './badgeEngine.js';
import pool from '../config/database.js';

export async function evaluateDailyActivityBadges() {
  const users = await pool.query('SELECT id FROM users LIMIT 500');
  let touched = 0;
  for (const row of users.rows) {
    const r = await evaluateBadgesForUser(row.id);
    if (r.changed > 0) touched += 1;
  }
  return { touched };
}
