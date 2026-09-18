/**
 * §9 — R1 kişisel mercek. Skora girmez; yalnız sahibinin arşiv-katmanı.
 */
import pool from '../config/database.js';

export function isR1SelfRow(row) {
  return String(row?.feedback_type || '').toLowerCase() === 'r1_self';
}

/**
 * Ritual FB listesinde R1 yalnız yazarına. Başkasının satırında r1_self alanı da silinir.
 */
export function filterFeedbackRowsForViewer(rows, viewerId) {
  const vid = viewerId != null ? String(viewerId) : '';
  return (rows || [])
    .filter((row) => {
      if (!isR1SelfRow(row)) return true;
      return Boolean(vid) && String(row.from_user_id || row.rater_id || '') === vid;
    })
    .map((row) => {
      const owner = Boolean(vid) && String(row.from_user_id || row.rater_id || '') === vid;
      if (owner || row.r1_self == null) return row;
      return { ...row, r1_self: null };
    });
}

export async function getOwnerR1Archive(userId, { limit = 50, offset = 0 } = {}) {
  const lim = Math.min(Number(limit) || 50, 100);
  const off = Math.max(Number(offset) || 0, 0);
  try {
    const r = await pool.query(
      `SELECT
         f.id,
         'r1' AS entry_type,
         f.ritual_id,
         f.r1_self,
         f.created_at,
         r.title AS ritual_title,
         r.start_time AS ritual_start_time
       FROM feedback f
       LEFT JOIN rituals r ON r.id = f.ritual_id
       WHERE f.from_user_id = $1
         AND f.feedback_type = 'r1_self'
         AND f.r1_self IS NOT NULL
       ORDER BY f.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, lim, off]
    );
    return {
      user_id: userId,
      entries: r.rows.map((row) => ({
        ...row,
        enters_rs: false,
        archive_only: true,
      })),
    };
  } catch (_e) {
    return { user_id: userId, entries: [] };
  }
}
