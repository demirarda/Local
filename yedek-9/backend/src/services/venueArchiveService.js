/**
 * Venue PUBLIC memory arsivi — son-part.md §9.5
 * Mekan silemez; yalnizca featured kurasyonu (vitrine).
 */
import pool from '../config/database.js';

export const PUBLIC_ARCHIVE_SQL = `
  (m.privacy::text = 'public'
   OR COALESCE(m.privacy_mode, '') = 'public'
   OR m.destination::text = 'ritual_and_pulse')
  AND COALESCE(m.csam_scan_status, 'clear') IN ('clear', 'provider_scanned', 'window_pass')
`;

async function isVenueManager(userId, venueId, email = '') {
  if (!userId) return false;
  const adminIds = (process.env.ADMIN_USER_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (adminIds.includes(String(userId))) return true;
  if (email && adminEmails.includes(String(email).toLowerCase())) return true;
  const r = await pool.query(
    `SELECT 1 FROM venue_managers WHERE venue_id = $1 AND user_id = $2 LIMIT 1`,
    [venueId, userId]
  );
  return r.rows.length > 0;
}

function mapMemoryRow(row) {
  return {
    id: row.id,
    ritual_id: row.ritual_id,
    user_id: row.user_id,
    user_name: row.user_name,
    type: row.type || row.memory_type,
    caption: row.caption || row.content_text || row.content,
    content_url: row.content_url,
    created_at: row.created_at,
    ritual_title: row.ritual_title,
    ritual_type: row.ritual_type,
    is_featured: Boolean(row.is_featured),
  };
}

export async function listVenueArchive(venueId, { limit = 30, offset = 0, featuredOnly = false } = {}) {
  const limitNum = Math.min(Math.max(Number(limit) || 30, 1), 100);
  const offsetNum = Math.max(Number(offset) || 0, 0);

  const r = await pool.query(
    `SELECT
       m.*,
       u.name AS user_name,
       r.title AS ritual_title,
       r.type AS ritual_type,
       (v.vitrine->'featured_memory_ids') @> to_jsonb(ARRAY[m.id::text]) AS is_featured
     FROM memories m
     JOIN rituals r ON r.id = m.ritual_id
     JOIN venues v ON v.id = r.venue_id
     JOIN users u ON u.id = m.user_id
     WHERE r.venue_id = $1
       AND r.suspended_at IS NULL
       AND ${PUBLIC_ARCHIVE_SQL}
       AND ($4::boolean = false OR (v.vitrine->'featured_memory_ids') @> to_jsonb(ARRAY[m.id::text]))
     ORDER BY
       CASE WHEN (v.vitrine->'featured_memory_ids') @> to_jsonb(ARRAY[m.id::text]) THEN 0 ELSE 1 END,
       m.created_at DESC
     LIMIT $2 OFFSET $3`,
    [venueId, limitNum, offsetNum, featuredOnly]
  );

  const countR = await pool.query(
    `SELECT COUNT(*)::int AS c
     FROM memories m
     JOIN rituals r ON r.id = m.ritual_id
     WHERE r.venue_id = $1
       AND r.suspended_at IS NULL
       AND ${PUBLIC_ARCHIVE_SQL}`,
    [venueId]
  );

  return {
    memories: r.rows.map(mapMemoryRow),
    total: countR.rows[0]?.c || 0,
    limit: limitNum,
    offset: offsetNum,
  };
}

export async function setFeaturedArchiveMemories(venueId, userId, memoryIds = [], email = '') {
  const allowed = await isVenueManager(userId, venueId, email);
  if (!allowed) return { ok: false, status: 403, error: 'Not allowed' };

  const ids = Array.isArray(memoryIds)
    ? memoryIds.map((id) => String(id).trim()).filter(Boolean).slice(0, 12)
    : [];

  if (ids.length > 0) {
    const validR = await pool.query(
      `SELECT m.id
       FROM memories m
       JOIN rituals r ON r.id = m.ritual_id
       WHERE r.venue_id = $1
         AND m.id = ANY($2::uuid[])
         AND r.suspended_at IS NULL
         AND ${PUBLIC_ARCHIVE_SQL}`,
      [venueId, ids]
    );
    const validIds = validR.rows.map((row) => String(row.id));
    if (validIds.length !== ids.length) {
      return { ok: false, status: 400, error: 'Some memories are not public archive entries for this venue' };
    }
  }

  const cur = await pool.query(`SELECT vitrine FROM venues WHERE id = $1`, [venueId]);
  if (cur.rows.length === 0) return { ok: false, status: 404, error: 'Venue not found' };

  const vitrine = { ...(cur.rows[0].vitrine || {}), featured_memory_ids: ids };
  const prev = new Set(
    Array.isArray(cur.rows[0].vitrine?.featured_memory_ids)
      ? cur.rows[0].vitrine.featured_memory_ids.map(String)
      : []
  );
  const upd = await pool.query(
    `UPDATE venues SET vitrine = $2::jsonb, updated_at = NOW() WHERE id = $1 RETURNING vitrine, name`,
    [venueId, JSON.stringify(vitrine)]
  );

  const newly = ids.filter((id) => !prev.has(String(id)));
  if (newly.length) {
    try {
      const { notifyVitrineSelected } = await import('./notifications.js');
      const owners = await pool.query(
        `SELECT m.id, m.user_id FROM memories m WHERE m.id = ANY($1::uuid[])`,
        [newly]
      );
      for (const row of owners.rows) {
        if (!row.user_id) continue;
        await notifyVitrineSelected(row.user_id, {
          memoryId: row.id,
          venueId,
          venueName: upd.rows[0]?.name,
        }).catch(() => {});
      }
    } catch (_e) {
      /* non-fatal */
    }
  }

  return { ok: true, featured_memory_ids: upd.rows[0].vitrine?.featured_memory_ids || ids };
}

export async function getFeaturedArchivePreview(venueId, limit = 3) {
  const featured = await listVenueArchive(venueId, { limit, offset: 0, featuredOnly: true });
  if (featured.memories.length > 0) return featured.memories;
  const all = await listVenueArchive(venueId, { limit, offset: 0 });
  return all.memories;
}
