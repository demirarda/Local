import express from 'express';
import pool from '../config/database.js';
import { authenticateToken } from './auth.js';
import { sendError } from '../utils/errorResponse.js';

const router = express.Router();

// GET /api/follows - Get user's follows/followers (optional user_id to fetch another user's list)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { type = 'following', user_id } = req.query; // type: 'following' or 'followers'
    const userId = user_id || req.user.userId;

    let query;
    if (type === 'following') {
      // Users + venues this user is following
      query = `
        SELECT *
        FROM (
          SELECT
            f.id,
            f.created_at,
            u.id as user_id,
            u.name as user_name,
            u.city as user_city,
            u.university as user_university,
            u.rs_score as user_rs_score,
            u.avatar_url as user_avatar_url,
            NULL::text as venue_name,
            (hv.id IS NOT NULL) as is_host_verified,
            CASE
              WHEN hv.id IS NOT NULL THEN 'host'
              ELSE 'user'
            END as role,
            NULL::uuid as brand_id,
            NULL::uuid as chain_id
          FROM follows f
          JOIN users u ON f.following_id = u.id
          LEFT JOIN host_verifications hv ON u.id = hv.user_id
            AND hv.status = 'active'
            AND (hv.expires_at IS NULL OR hv.expires_at > CURRENT_TIMESTAMP)
          WHERE f.follower_id = $1

          UNION ALL

          SELECT
            vf.id,
            vf.created_at,
            v.id as user_id,
            v.name as user_name,
            v.city as user_city,
            NULL::text as user_university,
            NULL::numeric as user_rs_score,
            CONCAT('https://picsum.photos/seed/venue-', REPLACE(v.id::text, '-', ''), '/320/320') as user_avatar_url,
            v.name as venue_name,
            false as is_host_verified,
            CASE
              WHEN v.brand_id IS NOT NULL THEN 'brand'
              ELSE 'venue'
            END as role,
            v.brand_id,
            v.chain_id
          FROM venue_follows vf
          JOIN venues v ON vf.venue_id = v.id
          WHERE vf.user_id = $1
        ) mixed
        ORDER BY created_at DESC
      `;
    } else {
      // Users who follow this user
      query = `
        SELECT 
          f.id,
          f.created_at,
          u.id as user_id,
          u.name as user_name,
          u.city as user_city,
          u.university as user_university,
          u.rs_score as user_rs_score,
          u.avatar_url as user_avatar_url,
          (hv.id IS NOT NULL) as is_host_verified,
          CASE 
            WHEN hv.id IS NOT NULL THEN 'host'
            ELSE 'user'
          END as role
        FROM follows f
        JOIN users u ON f.follower_id = u.id
        LEFT JOIN host_verifications hv ON u.id = hv.user_id 
          AND hv.status = 'active' 
          AND (hv.expires_at IS NULL OR hv.expires_at > CURRENT_TIMESTAMP)
        WHERE f.following_id = $1
        ORDER BY f.created_at DESC
      `;
    }

    let result;
    try {
      result = await pool.query(query, [userId]);
    } catch (colErr) {
      // Soft-fail: venues.brand_id / chain_id henüz migrate edilmemişse venue-only fallback
      const msg = String(colErr?.message || '');
      if (type === 'following' && /brand_id|chain_id/i.test(msg)) {
        result = await pool.query(
          `
          SELECT *
          FROM (
            SELECT
              f.id,
              f.created_at,
              u.id as user_id,
              u.name as user_name,
              u.city as user_city,
              u.university as user_university,
              u.rs_score as user_rs_score,
              u.avatar_url as user_avatar_url,
              NULL::text as venue_name,
              (hv.id IS NOT NULL) as is_host_verified,
              CASE WHEN hv.id IS NOT NULL THEN 'host' ELSE 'user' END as role,
              NULL::uuid as brand_id,
              NULL::uuid as chain_id
            FROM follows f
            JOIN users u ON f.following_id = u.id
            LEFT JOIN host_verifications hv ON u.id = hv.user_id
              AND hv.status = 'active'
              AND (hv.expires_at IS NULL OR hv.expires_at > CURRENT_TIMESTAMP)
            WHERE f.follower_id = $1
            UNION ALL
            SELECT
              vf.id,
              vf.created_at,
              v.id as user_id,
              v.name as user_name,
              v.city as user_city,
              NULL::text as user_university,
              NULL::numeric as user_rs_score,
              CONCAT('https://picsum.photos/seed/venue-', REPLACE(v.id::text, '-', ''), '/320/320') as user_avatar_url,
              v.name as venue_name,
              false as is_host_verified,
              'venue'::text as role,
              NULL::uuid as brand_id,
              NULL::uuid as chain_id
            FROM venue_follows vf
            JOIN venues v ON vf.venue_id = v.id
            WHERE vf.user_id = $1
          ) mixed
          ORDER BY created_at DESC
          `,
          [userId]
        );
      } else {
        throw colErr;
      }
    }

    const baseUrl = process.env.API_PUBLIC_URL || (req.protocol + '://' + req.get('host'));
    const { listCountMeta } = await import('../services/followerCountPolicy.js');
    const rows = result.rows.map(row => ({
        id: row.id,
        user: {
          id: row.user_id,
          name: row.user_name,
          city: row.user_city,
          university: row.user_university,
          rs_score: row.user_rs_score != null ? parseFloat(row.user_rs_score) : null,
          avatar_url: row.user_avatar_url
            ? (/^https?:\/\//i.test(row.user_avatar_url)
                ? row.user_avatar_url
                : `${baseUrl}${row.user_avatar_url.startsWith('/') ? '' : '/'}${row.user_avatar_url}`)
            : null,
          is_host_verified: !!row.is_host_verified,
          venue_name: row.venue_name || null,
          brand_id: row.brand_id || null,
          chain_id: row.chain_id || null,
        },
        role: row.role, // 'host' | 'venue' | 'brand' | 'user'
        brand_id: row.brand_id || null,
        is_host_verified: !!row.is_host_verified,
        created_at: row.created_at
      }));
    res.json({
      success: true,
      data: rows,
      meta: {
        type: type === 'followers' ? 'followers' : 'following',
        ...listCountMeta(rows.length),
      },
    });
  } catch (error) {
    console.error('Error fetching follows:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch follows'
    });
  }
});

// POST /api/follows - Follow a user (CLOSED profilde istek)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { following_id, bell } = req.body;
    const followerId = req.user.userId;

    if (!following_id) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'following_id is required');
    }

    const { requestOrFollow } = await import('../services/waveBSocial.js');
    const result = await requestOrFollow({
      fromUserId: followerId,
      toUserId: following_id,
      bell: bell === true,
    });
    if (!result.ok) {
      return sendError(res, result.status || 400, 'FOLLOW_ERROR', result.error);
    }
    if (result.mode === 'request') {
      return res.status(202).json({
        success: true,
        mode: 'request',
        data: result.request,
        message: 'Follow request sent',
      });
    }
    if (result.mode === 'already_following') {
      return res.status(409).json({
        error: {
          code: 'FOLLOW_ALREADY_EXISTS',
          message: 'Already following',
        },
      });
    }
    res.json({
      success: true,
      mode: 'follow',
      data: result.follow,
      message: 'Successfully followed',
    });
  } catch (error) {
    console.error('Error following user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to follow user',
    });
  }
});

// GET /api/follows/requests — gelen istekler
router.get('/requests', authenticateToken, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT fr.*, u.name AS from_name, u.avatar_url AS from_avatar
       FROM follow_requests fr
       JOIN users u ON u.id = fr.from_user_id
       WHERE fr.to_user_id = $1 AND fr.status = 'pending'
       ORDER BY fr.created_at DESC`,
      [req.user.userId]
    );
    res.json({ success: true, data: r.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to list follow requests' });
  }
});

// PATCH /api/follows/requests/:id — accept | decline (ret sessiz)
router.patch('/requests/:id', authenticateToken, async (req, res) => {
  try {
    const accept = req.body?.action === 'accept' || req.body?.accept === true;
    const { resolveFollowRequest } = await import('../services/waveBSocial.js');
    const result = await resolveFollowRequest({
      requestId: req.params.id,
      toUserId: req.user.userId,
      accept,
    });
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, error: result.error });
    }
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to resolve follow request' });
  }
});

// DELETE /api/follows/:followingId - Unfollow a user
router.delete('/:followingId', authenticateToken, async (req, res) => {
  try {
    const { followingId } = req.params;
    const followerId = req.user.userId;

    const result = await pool.query(
      `DELETE FROM follows 
       WHERE follower_id = $1 AND following_id = $2
       RETURNING *`,
      [followerId, followingId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Follow relationship not found'
      });
    }

    res.json({
      success: true,
      message: 'Successfully unfollowed'
    });
  } catch (error) {
    console.error('Error unfollowing user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to unfollow user'
    });
  }
});

// PATCH /api/follows/:followingId/bell — zil 🔔 (v2 §13)
router.patch('/:followingId/bell', authenticateToken, async (req, res) => {
  try {
    const bell = req.body.bell === true;
    const result = await pool.query(
      `UPDATE follows SET bell = $3
       WHERE follower_id = $1 AND following_id = $2
       RETURNING *`,
      [req.user.userId, req.params.followingId, bell]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Follow not found' });
    }
    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error updating follow bell', error);
    return res.status(500).json({ success: false, error: 'Failed to update bell' });
  }
});

// GET /api/follows/check - Check if user is following another user
router.get('/check', authenticateToken, async (req, res) => {
  try {
    const { following_id } = req.query;
    const followerId = req.user.userId;

    if (!following_id) {
      return res.status(400).json({
        success: false,
      error: 'following_id is required'
      });
    }

    const result = await pool.query(
      `SELECT * FROM follows 
       WHERE follower_id = $1 AND following_id = $2`,
      [followerId, following_id]
    );

    res.json({
      success: true,
      data: {
        is_following: result.rows.length > 0,
        bell: result.rows[0] ? Boolean(result.rows[0].bell) : false,
      },
    });
  } catch (error) {
    console.error('Error checking follow status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check follow status'
    });
  }
});

export default router;
