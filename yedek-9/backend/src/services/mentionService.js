/**
 * sonMD §7 Mention — masa bağlamı / arkadaşlar / hiçbiri
 * Etiketlenebilir: mühürlü masadaşlar, thread katılanlar, host/collaborator, venue/series hesabı.
 * Sadece arkadaş olmak yeterli değil (ritual bağlamında).
 */
import pool from '../config/database.js';
import LOCAL_CONFIG from '../config/localConfig.js';

const MENTION_RE = /@([a-zA-Z0-9_]{2,32})/g;

export function extractMentionHandles(text) {
  const handles = new Set();
  const s = String(text || '');
  let m;
  const re = new RegExp(MENTION_RE);
  while ((m = re.exec(s)) !== null) {
    handles.add(m[1].toLowerCase());
  }
  return [...handles];
}

/**
 * @param {'masa'|'friends'|'none'} preference
 */
export async function resolveMentionTargets({
  text,
  actorId,
  ritualId = null,
  threadId = null,
  preference = null,
}) {
  const pref =
    preference ||
    LOCAL_CONFIG.mention?.DEFAULT_PERMISSION ||
    'masa';
  if (pref === 'none') {
    return { ok: true, mentions: [], blocked: extractMentionHandles(text) };
  }

  const handles = extractMentionHandles(text);
  if (!handles.length) return { ok: true, mentions: [], blocked: [] };

  const users = await pool.query(
    `SELECT id, username, name FROM users
     WHERE LOWER(username) = ANY($1::text[])`,
    [handles]
  );
  const byHandle = new Map(
    users.rows.map((u) => [String(u.username || '').toLowerCase(), u])
  );

  let allowedIds = new Set();
  if (pref === 'friends') {
    const fr = await pool.query(
      `SELECT CASE WHEN user_id = $1 THEN friend_id ELSE user_id END AS peer
       FROM friendships
       WHERE (user_id = $1 OR friend_id = $1) AND status = 'accepted'`,
      [actorId]
    );
    allowedIds = new Set(fr.rows.map((r) => String(r.peer)));
  } else {
    // masa (default): sealed + host + collaborators + thread participants
    if (ritualId) {
      const sealed = await pool.query(
        `SELECT user_id FROM ritual_attendance
         WHERE ritual_id = $1 AND checkin_phase = 'sealed' AND checkin_at IS NOT NULL
         UNION
         SELECT host_id FROM rituals WHERE id = $1 AND host_id IS NOT NULL`,
        [ritualId]
      );
      for (const r of sealed.rows) allowedIds.add(String(r.user_id || r.host_id));

      const collab = await pool.query(
        `SELECT oc.user_id
         FROM organizers_collaborators oc
         JOIN rituals r ON (
           (oc.scope = 'series' AND oc.scope_id = r.series_id)
           OR (oc.scope = 'event_group' AND oc.scope_id = r.event_group_id)
         )
         WHERE r.id = $1 AND oc.status = 'active'`,
        [ritualId]
      ).catch(() => ({ rows: [] }));
      for (const r of collab.rows) allowedIds.add(String(r.user_id));
    }
    if (threadId) {
      const thr = await pool.query(
        `SELECT DISTINCT user_id FROM forum_comments WHERE thread_id = $1
         UNION
         SELECT user_id FROM forum_threads WHERE id = $1`,
        [threadId]
      ).catch(() => ({ rows: [] }));
      for (const r of thr.rows) allowedIds.add(String(r.user_id));
    }
  }

  const mentions = [];
  const blocked = [];
  for (const h of handles) {
    const u = byHandle.get(h);
    if (!u) {
      blocked.push(h);
      continue;
    }
    if (String(u.id) === String(actorId)) {
      mentions.push({ user_id: u.id, username: u.username, self: true });
      continue;
    }
    if (allowedIds.has(String(u.id))) {
      mentions.push({ user_id: u.id, username: u.username, name: u.name });
    } else {
      blocked.push(h);
    }
  }

  return { ok: true, mentions, blocked, preference: pref };
}

export async function persistMentions({
  sourceType,
  sourceId,
  ritualId,
  actorId,
  mentions,
}) {
  if (!mentions?.length) return [];
  const out = [];
  for (const m of mentions) {
    if (m.self) continue;
    const r = await pool
      .query(
        `INSERT INTO content_mentions (source_type, source_id, ritual_id, from_user_id, to_user_id)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT DO NOTHING
         RETURNING *`,
        [sourceType, sourceId, ritualId, actorId, m.user_id]
      )
      .catch(() => ({ rows: [] }));
    if (r.rows[0]) {
      out.push(r.rows[0]);
      try {
        const { notifyMention } = await import('./notifications.js');
        notifyMention(m.user_id, {
          fromUserId: actorId,
          sourceType,
          sourceId,
          ritualId,
        }).catch(() => {});
      } catch (_e) {
        /* non-fatal */
      }
    }
  }
  return out;
}
