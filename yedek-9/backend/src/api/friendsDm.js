/**
 * Friends-DM — F1.5 (sonMD Sosyal Temeller)
 * Yalnız karşılıklı arkadaşlar (friendships.status='accepted').
 * Cold-DM / message-request / sesli-görüntülü YOK (tasarım).
 * FRIENDS_DM_ENABLED:false → 410.
 */
import express from 'express';
import pool from '../config/database.js';
import LOCAL_CONFIG from '../config/localConfig.js';
import { authenticateToken } from './auth.js';

const router = express.Router();

const MESSAGE_MAX_CHARS = 2000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

function gate(res) {
  if (LOCAL_CONFIG.stubs?.FRIENDS_DM_ENABLED === true) {
    return true;
  }
  res.status(410).json({
    success: false,
    error: 'Friends-DM launch’ta yok — Faz 1.5 (karşılıklı arkadaşlar)',
    code: 'FRIENDS_DM_LATER',
    phase: 'F1.5',
    enabled: false,
  });
  return false;
}

/** dm_threads.user_a < user_b kanonik sırası */
function orderedPair(userId, otherId) {
  return String(userId) < String(otherId) ? [userId, otherId] : [otherId, userId];
}

async function areMutualFriends(userId, otherId) {
  const result = await pool.query(
    `SELECT 1 FROM friendships
     WHERE status = 'accepted'
       AND ((requester_id = $1 AND receiver_id = $2)
         OR (requester_id = $2 AND receiver_id = $1))
     LIMIT 1`,
    [userId, otherId]
  );
  return result.rows.length > 0;
}

async function isBlockedEitherWay(userId, otherId) {
  const result = await pool.query(
    `SELECT 1 FROM blocks
     WHERE (blocker_id = $1 AND blocked_user_id = $2)
        OR (blocker_id = $2 AND blocked_user_id = $1)
     LIMIT 1`,
    [userId, otherId]
  );
  return result.rows.length > 0;
}

/**
 * Thread'i çeker ve çağıran kullanıcının üye olduğunu doğrular.
 * @returns {Promise<{ thread: object, otherUserId: string, isUserA: boolean }|null>}
 */
async function loadThreadForUser(threadId, userId) {
  if (!UUID_RE.test(String(threadId || ''))) return null;
  const result = await pool.query(`SELECT * FROM dm_threads WHERE id = $1`, [threadId]);
  const thread = result.rows[0];
  if (!thread) return null;
  const isUserA = String(thread.user_a) === String(userId);
  const isUserB = String(thread.user_b) === String(userId);
  if (!isUserA && !isUserB) return null;
  return {
    thread,
    otherUserId: isUserA ? thread.user_b : thread.user_a,
    isUserA,
  };
}

async function openThread(userId, friendId) {
  const [userA, userB] = orderedPair(userId, friendId);
  const inserted = await pool.query(
    `INSERT INTO dm_threads (user_a, user_b)
     VALUES ($1, $2)
     ON CONFLICT (user_a, user_b) DO NOTHING
     RETURNING *`,
    [userA, userB]
  );
  if (inserted.rows.length > 0) {
    return { thread: inserted.rows[0], created: true };
  }
  const existing = await pool.query(
    `SELECT * FROM dm_threads WHERE user_a = $1 AND user_b = $2`,
    [userA, userB]
  );
  return { thread: existing.rows[0], created: false };
}

function serializeThreadRow(row, userId) {
  const isUserA = String(row.user_a) === String(userId);
  return {
    id: row.id,
    friend: {
      id: row.friend_id,
      name: row.friend_name,
      city: row.friend_city,
      university: row.friend_university,
      avatar_url: row.friend_avatar_url || null,
    },
    last_message_at: row.last_message_at,
    last_message_preview: row.last_message_preview,
    last_message_is_mine:
      row.last_message_sender_id == null
        ? null
        : String(row.last_message_sender_id) === String(userId),
    last_read_at: isUserA ? row.last_read_at_a : row.last_read_at_b,
    unread_count: Number(row.unread_count) || 0,
    created_at: row.created_at,
  };
}

function serializeMessage(row, userId) {
  return {
    id: row.id,
    thread_id: row.thread_id,
    sender_id: row.sender_id,
    sender_name: row.sender_name ?? undefined,
    body: row.deleted_at ? null : row.body,
    deleted: Boolean(row.deleted_at),
    edited_at: row.edited_at,
    is_mine: String(row.sender_id) === String(userId),
    created_at: row.created_at,
  };
}

router.use(authenticateToken);

// GET /api/friends-dm/threads — konuşma listesi (inbox)
async function listThreads(req, res) {
  if (!gate(res)) return;
  try {
    const userId = req.user.userId;
    const result = await pool.query(
      `SELECT
         t.*,
         CASE WHEN t.user_a = $1 THEN t.user_b ELSE t.user_a END AS friend_id,
         u.name AS friend_name,
         u.city AS friend_city,
         u.university AS friend_university,
         u.avatar_url AS friend_avatar_url,
         (
           SELECT COUNT(*)
           FROM dm_messages m
           WHERE m.thread_id = t.id
             AND m.sender_id <> $1
             AND m.deleted_at IS NULL
             AND m.created_at > COALESCE(
               CASE WHEN t.user_a = $1 THEN t.last_read_at_a ELSE t.last_read_at_b END,
               'epoch'::timestamptz
             )
         ) AS unread_count
       FROM dm_threads t
       JOIN users u
         ON u.id = CASE WHEN t.user_a = $1 THEN t.user_b ELSE t.user_a END
       WHERE t.user_a = $1 OR t.user_b = $1
       ORDER BY COALESCE(t.last_message_at, t.created_at) DESC`,
      [userId]
    );

    return res.json({
      success: true,
      data: result.rows.map((row) => serializeThreadRow(row, userId)),
    });
  } catch (error) {
    console.error('Error listing DM threads:', error);
    return res.status(500).json({ success: false, error: 'Failed to list threads' });
  }
}

// POST /api/friends-dm/threads — arkadaşla thread aç (idempotent)
async function createThread(req, res) {
  if (!gate(res)) return;
  try {
    const userId = req.user.userId;
    const friendId = req.body?.friend_id || req.body?.user_id;

    if (!friendId) {
      return res.status(400).json({ success: false, error: 'friend_id is required' });
    }
    if (String(friendId) === String(userId)) {
      return res.status(400).json({ success: false, error: 'Cannot open a thread with yourself' });
    }
    if (!(await areMutualFriends(userId, friendId))) {
      return res.status(403).json({
        success: false,
        error: 'Friends-DM yalnız karşılıklı arkadaşlar arasında açılır',
        code: 'FRIENDS_DM_NOT_MUTUAL',
      });
    }
    if (await isBlockedEitherWay(userId, friendId)) {
      return res.status(403).json({
        success: false,
        error: 'Engel nedeniyle mesajlaşma kapalı',
        code: 'FRIENDS_DM_BLOCKED',
      });
    }

    const { thread, created } = await openThread(userId, friendId);
    const friend = await pool.query(
      `SELECT id, name, city, university, avatar_url FROM users WHERE id = $1`,
      [friendId]
    );

    return res.status(created ? 201 : 200).json({
      success: true,
      created,
      data: {
        id: thread.id,
        friend: friend.rows[0] || { id: friendId },
        last_message_at: thread.last_message_at,
        last_message_preview: thread.last_message_preview,
        unread_count: 0,
        created_at: thread.created_at,
      },
    });
  } catch (error) {
    console.error('Error opening DM thread:', error);
    return res.status(500).json({ success: false, error: 'Failed to open thread' });
  }
}

// Inbox kısayolu: /api/friends-dm ile /api/friends-dm/threads aynı davranır.
router.get(['/', '/threads'], listThreads);
router.post(['/', '/threads'], createThread);

// GET /api/friends-dm/threads/:threadId/messages — mesaj geçmişi (yeniden eskiye sayfalama)
router.get('/threads/:threadId/messages', async (req, res) => {
  if (!gate(res)) return;
  try {
    const userId = req.user.userId;
    const { threadId } = req.params;
    const limit = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_PAGE_SIZE)
    );
    const before = req.query.before ? new Date(req.query.before) : null;

    const membership = await loadThreadForUser(threadId, userId);
    if (!membership) {
      return res.status(404).json({ success: false, error: 'Thread not found' });
    }

    const params = [threadId, limit];
    let beforeClause = '';
    if (before && !Number.isNaN(before.getTime())) {
      params.push(before);
      beforeClause = `AND m.created_at < $3`;
    }

    const result = await pool.query(
      `SELECT m.*, u.name AS sender_name
       FROM dm_messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.thread_id = $1 ${beforeClause}
       ORDER BY m.created_at DESC
       LIMIT $2`,
      params
    );

    const messages = result.rows.reverse().map((row) => serializeMessage(row, userId));

    return res.json({
      success: true,
      data: messages,
      has_more: result.rows.length === limit,
    });
  } catch (error) {
    console.error('Error fetching DM messages:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch messages' });
  }
});

// POST /api/friends-dm/threads/:threadId/messages — mesaj gönder
router.post('/threads/:threadId/messages', async (req, res) => {
  if (!gate(res)) return;
  try {
    const userId = req.user.userId;
    const { threadId } = req.params;
    const body = String(req.body?.body ?? req.body?.text ?? '').trim();

    if (!body) {
      return res.status(400).json({ success: false, error: 'body is required' });
    }
    if (body.length > MESSAGE_MAX_CHARS) {
      return res.status(400).json({
        success: false,
        error: `Mesaj en fazla ${MESSAGE_MAX_CHARS} karakter olabilir`,
        code: 'FRIENDS_DM_TOO_LONG',
      });
    }

    const membership = await loadThreadForUser(threadId, userId);
    if (!membership) {
      return res.status(404).json({ success: false, error: 'Thread not found' });
    }
    // Arkadaşlık bozulursa thread yazmaya kapanır (okuma açık kalır).
    if (!(await areMutualFriends(userId, membership.otherUserId))) {
      return res.status(403).json({
        success: false,
        error: 'Friends-DM yalnız karşılıklı arkadaşlar arasında açık',
        code: 'FRIENDS_DM_NOT_MUTUAL',
      });
    }
    if (await isBlockedEitherWay(userId, membership.otherUserId)) {
      return res.status(403).json({
        success: false,
        error: 'Engel nedeniyle mesajlaşma kapalı',
        code: 'FRIENDS_DM_BLOCKED',
      });
    }

    const client = await pool.connect();
    let message;
    try {
      await client.query('BEGIN');
      const inserted = await client.query(
        `INSERT INTO dm_messages (thread_id, sender_id, body)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [threadId, userId, body]
      );
      message = inserted.rows[0];
      await client.query(
        `UPDATE dm_threads
         SET last_message_at = $2,
             last_message_preview = LEFT($3, 140),
             last_message_sender_id = $4,
             last_read_at_a = CASE WHEN user_a = $4 THEN $2 ELSE last_read_at_a END,
             last_read_at_b = CASE WHEN user_b = $4 THEN $2 ELSE last_read_at_b END,
             updated_at = NOW()
         WHERE id = $1`,
        [threadId, message.created_at, body, userId]
      );
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    notifyDmMessage(membership.otherUserId, userId, threadId, body).catch(() => {});

    return res.status(201).json({
      success: true,
      data: serializeMessage(message, userId),
    });
  } catch (error) {
    console.error('Error sending DM message:', error);
    return res.status(500).json({ success: false, error: 'Failed to send message' });
  }
});

// POST /api/friends-dm/threads/:threadId/read — okundu işaretle
router.post('/threads/:threadId/read', async (req, res) => {
  if (!gate(res)) return;
  try {
    const userId = req.user.userId;
    const { threadId } = req.params;

    const membership = await loadThreadForUser(threadId, userId);
    if (!membership) {
      return res.status(404).json({ success: false, error: 'Thread not found' });
    }

    const column = membership.isUserA ? 'last_read_at_a' : 'last_read_at_b';
    const result = await pool.query(
      `UPDATE dm_threads SET ${column} = NOW(), updated_at = NOW()
       WHERE id = $1
       RETURNING ${column} AS last_read_at`,
      [threadId]
    );

    return res.json({ success: true, data: { last_read_at: result.rows[0]?.last_read_at } });
  } catch (error) {
    console.error('Error marking DM thread read:', error);
    return res.status(500).json({ success: false, error: 'Failed to mark thread read' });
  }
});

async function notifyDmMessage(recipientId, senderId, threadId, body) {
  const sender = await pool.query(`SELECT name FROM users WHERE id = $1`, [senderId]);
  const senderName = sender.rows[0]?.name || 'Arkadaşın';
  await pool.query(
    `INSERT INTO notifications (user_id, type, title, body, data)
     VALUES ($1, 'friends_dm_message', $2, $3, $4)`,
    [
      recipientId,
      senderName,
      body.slice(0, 140),
      JSON.stringify({ thread_id: threadId, sender_id: senderId }),
    ]
  );
}

export default router;
