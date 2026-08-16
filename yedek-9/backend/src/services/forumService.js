/**
 * Forum — son-part.md §8.2 (OPEN_FORUM Rituals, RS'e girmez)
 */
import pool from '../config/database.js';
import LOCAL_CONFIG from '../config/localConfig.js';
import { RITUAL_STATUS, getLifecyclePhase } from './ritualState.js';
import { assertCanJoinRitual } from './penaltyService.js';
import {
  notifyForumComment,
  notifyForumRepost,
  notifyForumUpvoteMilestone,
  notifyQuoteDiscussionInvite,
  nextUpvoteNotifyMilestone,
} from './notifications.js';

const { FORUM_SURFACE_WHOLE, FORUM_SURFACE_MEMORIES } = LOCAL_CONFIG.content;

export async function getForumRitual(ritualId) {
  const r = await pool.query(
    `SELECT id, title, status, start_time, duration, live_window_hours, host_id,
            window_type, forum_surface, window_ends_at, repost_count, reposted_at
     FROM rituals WHERE id = $1`,
    [ritualId]
  );
  return r.rows[0] ?? null;
}

export function isOpenForumRitual(ritual) {
  return String(ritual?.window_type || 'ephemeral') === 'open_forum';
}

export async function assertForumWritable(ritualId, userId) {
  const penaltyCheck = await assertCanJoinRitual(userId);
  if (!penaltyCheck.ok) {
    return {
      ok: false,
      status: 403,
      error: penaltyCheck.message || 'No-show askısı aktif — Local World\'e iz bırakamazsın.',
      code: penaltyCheck.code,
    };
  }

  const ritual = await getForumRitual(ritualId);
  if (!ritual) return { ok: false, status: 404, error: 'Ritual not found' };
  if (!isOpenForumRitual(ritual)) {
    return { ok: false, status: 403, error: 'Forum only available for open_forum rituals' };
  }
  const phase = getLifecyclePhase(ritual);
  if (phase !== RITUAL_STATUS.WINDOW && phase !== RITUAL_STATUS.ARCHIVED) {
    return { ok: false, status: 403, error: 'Forum is available during and after window phase' };
  }
  const att = await pool.query(
    `SELECT 1 FROM ritual_attendance
     WHERE ritual_id = $1 AND user_id = $2
       AND status NOT IN ('no_show', 'cancelled')
     LIMIT 1`,
    [ritualId, userId]
  );
  if (att.rows.length === 0) {
    return { ok: false, status: 403, error: 'Must attend ritual to participate in forum' };
  }
  return { ok: true, ritual };
}

/** Yorumlanabilir hedefler — forum_surface kuralına göre */
export async function listCommentableTargets(ritualId, userId) {
  const gate = await assertForumWritable(ritualId, userId);
  if (!gate.ok) return gate;

  const { ritual } = gate;
  const targets = [];

  if (ritual.forum_surface === FORUM_SURFACE_WHOLE) {
    targets.push({
      target_type: 'ritual_window',
      target_id: null,
      label: 'Ritual Window',
    });
  }

  const mem = await pool.query(
    `SELECT m.id, m.content, m.memory_type, m.user_id, u.name AS user_name
     FROM memories m
     JOIN users u ON u.id = m.user_id
     WHERE m.ritual_id = $1
       AND (
         $2::text = $3
         OR m.destination::text = 'ritual_and_pulse'
         OR m.privacy::text = 'public'
         OR COALESCE(m.privacy_mode, '') = 'public'
       )
     ORDER BY m.created_at DESC
     LIMIT 100`,
    [ritualId, ritual.forum_surface, FORUM_SURFACE_WHOLE]
  );

  for (const row of mem.rows) {
    targets.push({
      target_type: 'memory',
      target_id: row.id,
      label: row.content?.slice(0, 80) || 'Memory',
      user_name: row.user_name,
      memory_type: row.memory_type,
    });
  }

  return { ok: true, ritual, targets };
}

async function validateCommentTarget(ritual, targetType, targetId) {
  if (targetType === 'ritual_window') {
    if (ritual.forum_surface !== FORUM_SURFACE_WHOLE) {
      return { ok: false, error: 'Whole window comments not enabled for this ritual' };
    }
    return { ok: true };
  }
  if (targetType === 'memory') {
    if (!targetId) return { ok: false, error: 'target_id required for memory comments' };
    const m = await pool.query(
      `SELECT id FROM memories
       WHERE id = $1 AND ritual_id = $2
         AND (
           $3::text = $4
           OR destination::text = 'ritual_and_pulse'
           OR privacy::text = 'public'
           OR COALESCE(privacy_mode, '') = 'public'
         )`,
      [targetId, ritual.id, ritual.forum_surface, FORUM_SURFACE_WHOLE]
    );
    if (m.rows.length === 0) return { ok: false, error: 'Memory not commentable' };
    return { ok: true };
  }
  return { ok: false, error: 'Invalid target_type' };
}

export async function createForumComment({
  ritualId,
  userId,
  targetType,
  targetId = null,
  parentId = null,
  content,
}) {
  const gate = await assertForumWritable(ritualId, userId);
  if (!gate.ok) return gate;

  const text = String(content || '').trim();
  if (!text) return { ok: false, status: 400, error: 'content is required' };

  const targetCheck = await validateCommentTarget(gate.ritual, targetType, targetId);
  if (!targetCheck.ok) return { ok: false, status: 400, error: targetCheck.error };

  const r = await pool.query(
    `INSERT INTO forum_comments (ritual_id, user_id, target_type, target_id, parent_id, content)
     VALUES ($1, $2, $3::forum_comment_target, $4, $5, $6)
     RETURNING *`,
    [ritualId, userId, targetType, targetId, parentId, text.slice(0, 4000)]
  );

  const comment = r.rows[0];
  const recipients = new Set();
  if (parentId) {
    const parent = await pool.query(`SELECT user_id FROM forum_comments WHERE id = $1`, [parentId]);
    if (parent.rows[0]?.user_id) recipients.add(parent.rows[0].user_id);
  } else if (targetType === 'memory' && targetId) {
    const mem = await pool.query(`SELECT user_id, type FROM memories WHERE id = $1`, [targetId]);
    if (mem.rows[0]?.user_id) recipients.add(mem.rows[0].user_id);
    if (mem.rows[0]?.type === 'quote' && !parentId) {
      for (const recipientUserId of recipients) {
        notifyQuoteDiscussionInvite({
          recipientUserId,
          actorUserId: userId,
          ritualId,
          commentId: comment.id,
          memoryId: targetId,
        }).catch(() => {});
      }
      return { ok: true, comment };
    }
  } else if (targetType === 'ritual_window' && gate.ritual.host_id) {
    recipients.add(gate.ritual.host_id);
  }
  for (const recipientUserId of recipients) {
    notifyForumComment({
      recipientUserId,
      actorUserId: userId,
      ritualId,
      commentId: comment.id,
      isReply: Boolean(parentId),
    }).catch(() => {});
  }

  return { ok: true, comment };
}

export async function voteForumComment(commentId, userId, vote) {
  const v = Number(vote);
  if (v !== 1 && v !== -1) {
    return { ok: false, status: 400, error: 'vote must be 1 or -1' };
  }

  const comment = await pool.query(
    `SELECT id, user_id, ritual_id, upvote_notify_milestone FROM forum_comments WHERE id = $1`,
    [commentId]
  );
  if (comment.rows.length === 0) return { ok: false, status: 404, error: 'Comment not found' };

  const gate = await assertForumWritable(comment.rows[0].ritual_id, userId);
  if (!gate.ok) return gate;

  await pool.query(
    `INSERT INTO forum_votes (comment_id, user_id, vote)
     VALUES ($1, $2, $3)
     ON CONFLICT (comment_id, user_id) DO UPDATE SET vote = EXCLUDED.vote`,
    [commentId, userId, v]
  );

  const tally = await pool.query(
    `SELECT
       COALESCE(SUM(vote), 0)::int AS score,
       COUNT(*) FILTER (WHERE vote = 1)::int AS upvotes,
       COUNT(*) FILTER (WHERE vote = -1)::int AS downvotes
     FROM forum_votes WHERE comment_id = $1`,
    [commentId]
  );

  const upvotes = tally.rows[0]?.upvotes || 0;
  const milestone = nextUpvoteNotifyMilestone(comment.rows[0].upvote_notify_milestone || 0, upvotes);
  if (v === 1 && milestone) {
    await pool.query(
      `UPDATE forum_comments SET upvote_notify_milestone = $2 WHERE id = $1`,
      [commentId, milestone]
    );
    notifyForumUpvoteMilestone({
      recipientUserId: comment.rows[0].user_id,
      ritualId: comment.rows[0].ritual_id,
      commentId,
      upvotes,
      milestone,
    }).catch(() => {});
  }

  return { ok: true, vote: v, tally: tally.rows[0] };
}

export async function listForumComments(ritualId, userId, { targetType, targetId } = {}) {
  const gate = await assertForumWritable(ritualId, userId);
  if (!gate.ok) return gate;

  const params = [ritualId];
  let filter = '';
  if (targetType) {
    params.push(targetType);
    filter += ` AND c.target_type = $${params.length}::forum_comment_target`;
  }
  if (targetId) {
    params.push(targetId);
    filter += ` AND c.target_id = $${params.length}`;
  }

  const r = await pool.query(
    `SELECT
       c.*,
       u.name AS user_name,
       u.avatar_url,
       COALESCE(vt.score, 0)::int AS vote_score,
       COALESCE(vt.upvotes, 0)::int AS upvotes,
       COALESCE(vt.downvotes, 0)::int AS downvotes,
       mv.vote AS my_vote
     FROM forum_comments c
     JOIN users u ON u.id = c.user_id
     LEFT JOIN (
       SELECT comment_id,
              SUM(vote) AS score,
              COUNT(*) FILTER (WHERE vote = 1) AS upvotes,
              COUNT(*) FILTER (WHERE vote = -1) AS downvotes
       FROM forum_votes GROUP BY comment_id
     ) vt ON vt.comment_id = c.id
     LEFT JOIN forum_votes mv ON mv.comment_id = c.id AND mv.user_id = $${params.length + 1}
     WHERE c.ritual_id = $1 ${filter}
     ORDER BY c.created_at ASC`,
    [...params, userId]
  );

  return {
    ok: true,
    comments: r.rows.map((row) => ({
      ...row,
      // sonMD: ▲ ve ▼ sayaçları public; oy kimlikleri anonim
    })),
    ritual: gate.ritual,
  };
}

export async function createPulseRepost({ ritualId, userId, commentId = null, memoryId = null }) {
  const gate = await assertForumWritable(ritualId, userId);
  if (!gate.ok) return gate;

  if (!commentId && !memoryId) {
    return { ok: false, status: 400, error: 'comment_id or memory_id required' };
  }

  const ttlHours = LOCAL_CONFIG.content.PULSE_TTL_HOURS;
  const expiresAt = new Date(Date.now() + ttlHours * 3600000);

  const ins = await pool.query(
    `INSERT INTO pulse_reposts (source_ritual_id, user_id, comment_id, memory_id, expires_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [ritualId, userId, commentId, memoryId, expiresAt]
  );

  await pool.query(
    `UPDATE rituals
     SET repost_count = COALESCE(repost_count, 0) + 1,
         reposted_at = COALESCE(reposted_at, NOW()),
         updated_at = NOW()
     WHERE id = $1`,
    [ritualId]
  );

  if (gate.ritual.host_id && String(gate.ritual.host_id) !== String(userId)) {
    notifyForumRepost({
      recipientUserId: gate.ritual.host_id,
      actorUserId: userId,
      ritualId,
      repostId: ins.rows[0].id,
    }).catch(() => {});
  }

  return { ok: true, repost: ins.rows[0] };
}

export async function listRitualReposts(ritualId, { limit = 50 } = {}) {
  const r = await pool.query(
    `SELECT
       pr.*,
       u.name AS user_name,
       u.avatar_url AS user_avatar,
       fc.content AS comment_content,
       m.content AS memory_content,
       m.photo_url AS memory_photo_url,
       m.image_url AS memory_image_url
     FROM pulse_reposts pr
     JOIN users u ON u.id = pr.user_id
     LEFT JOIN forum_comments fc ON fc.id = pr.comment_id
     LEFT JOIN memories m ON m.id = pr.memory_id
     WHERE pr.source_ritual_id = $1
     ORDER BY pr.created_at DESC
     LIMIT $2`,
    [ritualId, Math.min(Number(limit) || 50, 100)]
  );
  return r.rows.map((row) => ({
    ...row,
    snippet:
      row.comment_content ||
      row.memory_content ||
      '',
    preview_image: row.memory_photo_url || row.memory_image_url || null,
  }));
}

export async function listActivePulseReposts(viewerId, { limit = 30, surface = 'your_pulse' } = {}) {
  const surf = String(surface || 'your_pulse').toLowerCase();
  // sonMD echo-guard: CIRCLE echo Your Pulse'ta kalır; Local World yalnız CITY
  const audienceClause =
    surf === 'local_world' || surf === 'city' || surf === 'lw'
      ? `AND (pr.memory_id IS NULL OR COALESCE(UPPER(m.audience), CASE
            WHEN COALESCE(m.memory_scope::text, '') = 'all' THEN 'CITY'
            WHEN COALESCE(m.memory_scope::text, '') = 'pulse' THEN 'CIRCLE'
            ELSE 'WINDOW' END) = 'CITY')`
      : `AND (pr.memory_id IS NULL OR COALESCE(UPPER(m.audience), CASE
            WHEN COALESCE(m.memory_scope::text, '') = 'all' THEN 'CITY'
            WHEN COALESCE(m.memory_scope::text, '') = 'pulse' THEN 'CIRCLE'
            ELSE 'WINDOW' END) IN ('CIRCLE', 'CITY'))`;

  const r = await pool.query(
    `SELECT
       pr.*,
       r.title AS ritual_title,
       r.location_name AS venue_name,
       r.window_type,
       u.name AS user_name,
       u.avatar_url AS user_avatar,
       fc.content AS comment_content,
       m.content AS memory_content,
       m.photo_url AS memory_photo_url,
       m.image_url AS memory_image_url,
       COALESCE(UPPER(m.audience), CASE
         WHEN COALESCE(m.memory_scope::text, '') = 'all' THEN 'CITY'
         WHEN COALESCE(m.memory_scope::text, '') = 'pulse' THEN 'CIRCLE'
         ELSE 'WINDOW' END) AS memory_audience
     FROM pulse_reposts pr
     JOIN rituals r ON r.id = pr.source_ritual_id
     JOIN users u ON u.id = pr.user_id
     LEFT JOIN forum_comments fc ON fc.id = pr.comment_id
     LEFT JOIN memories m ON m.id = pr.memory_id
     WHERE pr.expires_at > NOW()
       ${audienceClause}
     ORDER BY pr.created_at DESC
     LIMIT $1`,
    [Math.min(Number(limit) || 30, 100)]
  );
  return r.rows.map((row) => ({
    ...row,
    snippet:
      row.comment_content ||
      row.memory_content ||
      row.ritual_title ||
      '',
    preview_image: row.memory_photo_url || row.memory_image_url || null,
  }));
}
