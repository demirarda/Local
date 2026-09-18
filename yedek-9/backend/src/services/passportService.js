/**
 * Social Passport — son-part.md §8.1 (memory + badge + quote)
 * §9: R1 yalnız sahibinin arşiv-katmanında (bu endpoint /me).
 */
import pool from '../config/database.js';
import { getOwnerR1Archive } from './r1ArchiveService.js';

export async function getPassportEntries(userId, { limit = 50, offset = 0 } = {}) {
  const lim = Math.min(Number(limit) || 50, 100);
  const off = Math.max(Number(offset) || 0, 0);

  const [memories, badges, quotes, r1Archive] = await Promise.all([
    pool.query(
      `SELECT
         m.id,
         'memory' AS entry_type,
         m.ritual_id,
         m.content,
         m.memory_type,
         m.type AS memory_kind,
         m.created_at,
         r.title AS ritual_title,
         r.location_name AS venue_name
       FROM memories m
       LEFT JOIN rituals r ON r.id = m.ritual_id
       INNER JOIN ritual_attendance ra
         ON ra.ritual_id = m.ritual_id
         AND ra.user_id = m.user_id
         AND ra.checkin_at IS NOT NULL
         AND ra.status NOT IN ('no_show', 'cancelled')
       WHERE m.user_id = $1
         AND m.memory_type IN ('ritual', 'pulse')
       ORDER BY m.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, lim, off]
    ),
    pool.query(
      `SELECT
         ub.id,
         'badge' AS entry_type,
         ub.badge_key,
         ub.badge_label,
         ub.awarded_at AS created_at,
         ub.source_ritual_id AS ritual_id
       FROM user_badges ub
       WHERE ub.user_id = $1
       ORDER BY ub.awarded_at DESC NULLS LAST
       LIMIT $2`,
      [userId, lim]
    ),
    pool.query(
      `SELECT
         m.id,
         'quote' AS entry_type,
         m.ritual_id,
         m.content,
         m.created_at,
         r.title AS ritual_title
       FROM memories m
       LEFT JOIN rituals r ON r.id = m.ritual_id
       WHERE m.user_id = $1
         AND (m.type::text = 'quote' OR m.memory_type = 'ritual')
         AND m.content IS NOT NULL
         AND length(trim(m.content)) > 0
         AND length(trim(m.content)) <= 280
       ORDER BY m.created_at DESC
       LIMIT $2`,
      [userId, lim]
    ),
    getOwnerR1Archive(userId, { limit: lim, offset: off }),
  ]);

  const entries = [
    ...memories.rows.map((row) => ({ ...row, passport_eligible: true })),
    ...badges.rows.map((row) => ({ ...row, passport_eligible: true })),
  ];

  const quoteIds = new Set(memories.rows.map((m) => m.id));
  for (const q of quotes.rows) {
    if (!quoteIds.has(q.id)) {
      entries.push({ ...q, passport_eligible: true, entry_type: 'quote' });
    }
  }

  for (const row of r1Archive.entries || []) {
    entries.push({
      ...row,
      passport_eligible: true,
      entry_type: 'r1',
    });
  }

  entries.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return {
    user_id: userId,
    entries: entries.slice(0, lim),
    counts: {
      memories: memories.rows.length,
      badges: badges.rows.length,
      quotes: quotes.rows.length,
      r1: (r1Archive.entries || []).length,
    },
    note: 'Passport-pure: comments and reposts are excluded per son-part.md §8.1. R1 is owner-archive only.',
  };
}
