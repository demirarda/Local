import express from 'express';
import pool from '../config/database.js';
import { notifyFriendRequestAccepted, notifyFriendRequest } from '../services/notifications.js';
import { authenticateToken } from './auth.js';
import { getRsPublicFlags, resolveRsForViewer } from '../services/rsVisibility.js';
import { enqueue } from '../services/queueSystem.js';
import { sendError } from '../utils/errorResponse.js';

const router = express.Router();

async function enqueueNotificationOrFallback({ user_id, type, title, body, data, fallback }) {
  try {
    await enqueue(
      'notification-send',
      { user_id, type, title, body, data: data || {} },
      { priority: 5 }
    );
  } catch (_e) {
    if (typeof fallback === 'function') {
      await fallback();
    }
  }
}

// POST /api/friends/request
// backend-yeni.md contract alias for creating friend request.
router.post('/request', authenticateToken, async (req, res) => {
  req.body = {
    ...req.body,
    friend_id: req.body?.friend_id || req.body?.receiver_id
  };
  return router.handle(
    { ...req, method: 'POST', url: '/' },
    res
  );
});

// POST /api/friends/bump — QR-bump (son-part.md §4.1)
router.post('/bump', authenticateToken, async (req, res) => {
  try {
    let { target_user_id, qr_payload } = req.body || {};
    if (qr_payload) {
      const match = String(qr_payload).trim().match(/LOCAL:USER:([0-9a-f-]{36})/i);
      if (match) target_user_id = match[1];
    }
    if (!target_user_id) {
      return res.status(400).json({ success: false, error: 'target_user_id or qr_payload required' });
    }
    req.body = { friend_id: target_user_id };
    return router.handle({ ...req, method: 'POST', url: '/' }, res);
  } catch (error) {
    return res.status(500).json({ success: false, error: 'QR bump failed' });
  }
});

// PATCH /api/friends/:id/accept
// backend-yeni.md contract.
router.patch('/:id/accept', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const result = await pool.query(
      `UPDATE friendships
       SET status = 'accepted', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
         AND receiver_id = $2
         AND status = 'pending'
       RETURNING *`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Pending friendship request not found'
      });
    }

    const accepted = result.rows[0];
    const accepterResult = await pool.query(
      `SELECT name FROM users WHERE id = $1`,
      [userId]
    );
    const accepterName = accepterResult.rows[0]?.name || 'Biri';
    await enqueueNotificationOrFallback({
      user_id: accepted.requester_id,
      type: 'friend_accepted',
      title: 'Arkadaşlık Onayı',
      body: `${accepterName || 'Biri'} ile artık arkadaşsınız`,
      data: { friend_id: userId, friend_name: accepterName, masked_label: 'someone' },
      fallback: async () => notifyFriendRequestAccepted(accepted.requester_id, accepterName, userId),
    });

    return res.json({
      success: true,
      data: accepted,
      message: 'Friend request accepted'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to accept friend request'
    });
  }
});

// PATCH /api/friends/:id/decline
// backend-yeni.md contract.
router.patch('/:id/decline', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const result = await pool.query(
      `UPDATE friendships
       SET status = 'declined', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
         AND receiver_id = $2
         AND status = 'pending'
       RETURNING *`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Pending friendship request not found'
      });
    }

    return res.json({
      success: true,
      data: result.rows[0],
      message: 'Friend request declined'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to decline friend request'
    });
  }
});

// GET /api/friends - Get user's friends (optional user_id to fetch another user's friends)
// §2Ağu-3 friends_list_public: non-owner requires opt-in (default false)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status = 'accepted', user_id } = req.query;
    const userId = user_id || req.user.userId;
    const viewerId = req.user.userId;
    const viewingOther = String(userId) !== String(viewerId);

    if (viewingOther) {
      const priv = await pool.query(
        `SELECT COALESCE(u.friends_list_public, us.show_friends_list, false) AS friends_list_public
         FROM users u
         LEFT JOIN user_settings us ON us.user_id = u.id
         WHERE u.id = $1`,
        [userId]
      );
      if (!priv.rows[0]) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }
      if (!priv.rows[0].friends_list_public) {
        return res.status(403).json({
          success: false,
          error: 'Friends list is private',
          code: 'FRIENDS_LIST_PRIVATE',
        });
      }
    }

    const query = `
      SELECT 
        f.id,
        f.status,
        f.created_at,
        f.friendship_level,
        f.fb_count,
        f.last_feedback_at,
        CASE 
          WHEN f.requester_id = $1 THEN f.receiver_id
          ELSE f.requester_id
        END as friend_id,
        u.name as friend_name,
        u.city as friend_city,
        u.university as friend_university,
        u.rs_score as friend_rs_score,
        u.avatar_url as friend_avatar_url
      FROM friendships f
      JOIN users u ON (
        CASE 
          WHEN f.requester_id = $1 THEN u.id = f.receiver_id
          ELSE u.id = f.requester_id
        END
      )
      WHERE (f.requester_id = $1 OR f.receiver_id = $1)
        AND f.status = $2
      ORDER BY f.created_at DESC
    `;

    const result = await pool.query(query, [userId, status]);

    const publicFlags = await getRsPublicFlags(result.rows.map((row) => row.friend_id));
    const baseUrl = process.env.API_PUBLIC_URL || (req.protocol + '://' + req.get('host'));
    res.json({
      success: true,
      data: result.rows.map(row => {
        const rsResolved = resolveRsForViewer(
          viewerId,
          row.friend_id,
          parseFloat(row.friend_rs_score),
          publicFlags
        );
        return {
        id: row.id,
        friend: {
          id: row.friend_id,
          name: row.friend_name,
          city: row.friend_city,
          university: row.friend_university,
          rs_score: rsResolved.rs_score,
          rs_visible: rsResolved.rs_visible,
          avatar_url: row.friend_avatar_url ? `${baseUrl}${row.friend_avatar_url.startsWith('/') ? '' : '/'}${row.friend_avatar_url}` : null
        },
        status: row.status,
        friendship_level: row.friendship_level || 'stranger',
        fb_count: Number(row.fb_count) || 0,
        last_feedback_at: row.last_feedback_at,
        created_at: row.created_at
      };
      })
    });
  } catch (error) {
    console.error('Error fetching friends:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch friends'
    });
  }
});

// POST /api/friends - Send friend request
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { friend_id } = req.body;
    const userId = req.user.userId;

    if (!friend_id) {
      return res.status(400).json({
        success: false,
      error: 'friend_id is required'
      });
    }

    if (userId === friend_id) {
      return res.status(400).json({
        success: false,
        error: 'Cannot add yourself as a friend'
      });
    }

    // Check if friendship already exists
    const existing = await pool.query(
      `SELECT * FROM friendships 
       WHERE (requester_id = $1 AND receiver_id = $2) 
          OR (requester_id = $2 AND receiver_id = $1)`,
      [userId, friend_id]
    );

    if (existing.rows.length > 0) {
      const existingFriendship = existing.rows[0];
      
      // If blocked, return error
      if (existingFriendship.status === 'blocked') {
        return res.status(403).json({
          success: false,
          error: 'Cannot send friend request to blocked user'
        });
      }

      // If already accepted, return existing
      if (existingFriendship.status === 'accepted') {
        return sendError(res, 409, 'FRIENDSHIP_ALREADY_EXISTS', 'Already friends', existingFriendship);
      }

      // If pending, update to accepted if the other user is requesting
      if (existingFriendship.status === 'pending') {
        if (existingFriendship.receiver_id === userId) {
          // Accept the request
          const updateResult = await pool.query(
            `UPDATE friendships 
             SET status = 'accepted', updated_at = CURRENT_TIMESTAMP
             WHERE id = $1
             RETURNING *`,
            [existingFriendship.id]
          );
          
          // Get friend name for notification
          const friendResult = await pool.query(
            `SELECT name FROM users WHERE id = $1`,
            [userId]
          );
          const friendName = friendResult.rows[0]?.name || 'Someone';
          
          // Send notification to the other user (queue first, fallback direct)
          await enqueueNotificationOrFallback({
            user_id: existingFriendship.requester_id,
            type: 'friend_accepted',
            title: 'Arkadaşlık Onayı',
            body: `${friendName || 'Biri'} ile artık arkadaşsınız`,
            data: { friend_id: userId, friend_name: friendName, masked_label: 'someone' },
            fallback: async () => notifyFriendRequestAccepted(existingFriendship.requester_id, friendName, userId),
          });
          
          return res.json({
            success: true,
            data: updateResult.rows[0],
            message: 'Friend request accepted'
          });
        } else {
          return sendError(res, 409, 'FRIEND_REQUEST_ALREADY_SENT', 'Friend request already sent', existingFriendship);
        }
      }
    }

    // Create new friendship request
    const result = await pool.query(
      `INSERT INTO friendships (requester_id, receiver_id, status)
       VALUES ($1, $2, 'pending')
       RETURNING *`,
      [userId, friend_id]
    );

    const requesterResult = await pool.query(
      `SELECT name FROM users WHERE id = $1`,
      [userId]
    );
    const requesterName = requesterResult.rows[0]?.name || 'Biri';
    await enqueueNotificationOrFallback({
      user_id: friend_id,
      type: 'friend_request',
      title: 'Arkadaşlık İsteği',
      body: `${requesterName || 'Biri'} bağlanmak istiyor`,
      data: { sender_id: userId, friend_name: requesterName },
      fallback: async () => notifyFriendRequest(friend_id, requesterName, userId),
    });

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Friend request sent'
    });
  } catch (error) {
    console.error('Error sending friend request:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send friend request'
    });
  }
});

// DELETE /api/friends/:id - Remove/unfriend
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    // Verify user is part of this friendship
    const check = await pool.query(
      `SELECT * FROM friendships 
       WHERE id = $1 AND (requester_id = $2 OR receiver_id = $2)`,
      [id, userId]
    );

    if (check.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Friendship not found'
      });
    }

    // Delete the friendship
    await pool.query(
      `DELETE FROM friendships WHERE id = $1`,
      [id]
    );

    res.json({
      success: true,
      message: 'Friendship removed'
    });
  } catch (error) {
    console.error('Error removing friend:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove friend'
    });
  }
});

// GET /api/friends/pending - Get pending friend requests
router.get('/pending', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get pending requests where user is the recipient
    const query = `
      SELECT 
        f.id,
        f.created_at,
        u.id as requester_id,
        u.name as requester_name,
        u.city as requester_city,
        u.university as requester_university,
        u.rs_score as requester_rs_score
      FROM friendships f
      JOIN users u ON f.requester_id = u.id
      WHERE f.receiver_id = $1 AND f.status = 'pending'
      ORDER BY f.created_at DESC
    `;

    const result = await pool.query(query, [userId]);
    const publicFlags = await getRsPublicFlags(result.rows.map((row) => row.requester_id));

    res.json({
      success: true,
      data: result.rows.map(row => {
        const rsResolved = resolveRsForViewer(
          userId,
          row.requester_id,
          parseFloat(row.requester_rs_score),
          publicFlags
        );
        return {
        id: row.id,
        requester: {
          id: row.requester_id,
          name: row.requester_name,
          city: row.requester_city,
          university: row.requester_university,
          rs_score: rsResolved.rs_score,
          rs_visible: rsResolved.rs_visible,
        },
        created_at: row.created_at
      };
      })
    });
  } catch (error) {
    console.error('Error fetching pending requests:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pending requests'
    });
  }
});

// GET /api/friends/requests
// backend-yeni.md contract alias.
router.get('/requests', authenticateToken, async (req, res) => {
  return router.handle(
    { ...req, method: 'GET', url: '/pending' },
    res
  );
});

// GET /api/friends/pulse-events - Recent friendship events scoped to shared rituals
// Used for Pulse "Friend became friends" cards
router.get('/pulse-events', authenticateToken, async (req, res) => {
  try {
    const { limit = 5 } = req.query;
    const viewerId = req.user.userId;

    const eventsQuery = `
      WITH recent_friendships AS (
        SELECT
          f.id,
          f.requester_id,
          f.receiver_id,
          f.created_at
        FROM friendships f
        WHERE (f.requester_id = $1 OR f.receiver_id = $1)
          AND f.status = 'accepted'
          AND f.created_at >= NOW() - INTERVAL '24 hours'
      ), shared_rituals AS (
        SELECT
          rf.id as friendship_id,
          rf.created_at as friendship_created_at,
          r.id as ritual_id,
          r.title as ritual_title,
          r.location_name,
          r.start_time
        FROM recent_friendships rf
        JOIN LATERAL (
          SELECT
            r_inner.id,
            r_inner.title,
            r_inner.location_name,
            r_inner.start_time
          FROM ritual_attendance ra_viewer
          JOIN ritual_attendance ra_friend
            ON ra_viewer.ritual_id = ra_friend.ritual_id
          JOIN rituals r_inner
            ON r_inner.id = ra_viewer.ritual_id
          WHERE ra_viewer.user_id = $1
            AND ra_friend.user_id = (CASE WHEN rf.requester_id = $1 THEN rf.receiver_id ELSE rf.requester_id END)
            AND ra_viewer.status != 'no_show'
            AND ra_friend.status != 'no_show'
            AND r_inner.start_time <= rf.created_at
          ORDER BY r_inner.start_time DESC
          LIMIT 1
        ) r ON TRUE
      )
      SELECT
        sr.ritual_id,
        sr.ritual_title,
        sr.location_name,
        sr.start_time,
        COUNT(DISTINCT sr.friendship_id) AS new_friends,
        MAX(sr.friendship_created_at) AS latest_friendship_at
      FROM shared_rituals sr
      GROUP BY sr.ritual_id, sr.ritual_title, sr.location_name, sr.start_time
      ORDER BY latest_friendship_at DESC
      LIMIT $2
    `;

    const result = await pool.query(eventsQuery, [viewerId, parseInt(limit, 10)]);

    const events = result.rows.map(row => ({
      type: 'friend_became_friends',
      ritual_id: row.ritual_id,
      ritual_title: row.ritual_title,
      venue_name: row.location_name,
      location_name: row.location_name,
      start_time: row.start_time,
      new_friends: parseInt(row.new_friends, 10) || 0,
      latest_friendship_at: row.latest_friendship_at,
    }));

    return res.json({
      success: true,
      data: events,
    });
  } catch (error) {
    console.error('Error fetching pulse friend events:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch pulse friend events',
    });
  }
});

export default router;
