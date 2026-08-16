import express from 'express';
import pool from '../config/database.js';
import { authenticateToken } from './auth.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Helper: check if venue is verified (venue_verifications)
async function getVenueVerified(venueName, city) {
  if (!venueName || !city) return false;
  const r = await pool.query(
    `SELECT 1 FROM venue_verifications
     WHERE venue_name = $1 AND city = $2 AND status = 'active'
       AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
     LIMIT 1`,
    [venueName, city]
  );
  return r.rows.length > 0;
}

// GET /api/venue-follows - My followed venues (auth required)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const result = await pool.query(
      `SELECT vf.id, vf.venue_id, vf.created_at, COALESCE(vf.bell, false) AS bell,
              v.name AS venue_name, v.city AS venue_city, v.address, v.slug
       FROM venue_follows vf
       JOIN venues v ON v.id = vf.venue_id
       WHERE vf.user_id = $1
       ORDER BY vf.created_at DESC`,
      [userId]
    );

    const withVerified = [];
    for (const row of result.rows) {
      const isVerified = await getVenueVerified(row.venue_name, row.venue_city);
      withVerified.push({
        id: row.id,
        venue_id: row.venue_id,
        venue_name: row.venue_name,
        venue_city: row.venue_city,
        venue_address: row.address || null,
        venue_slug: row.slug || null,
        is_verified: isVerified,
        followed_at: row.created_at,
        bell: Boolean(row.bell),
      });
    }

    res.json({ success: true, data: withVerified });
  } catch (error) {
    logger.error('Error listing venue follows', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to list followed venues' });
  }
});

// POST /api/venue-follows - Follow a venue (body: venue_id)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { venue_id } = req.body;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    if (!venue_id) {
      return res.status(400).json({ success: false, error: 'venue_id is required' });
    }

    const venueCheck = await pool.query('SELECT id, name, city FROM venues WHERE id = $1', [venue_id]);
    if (venueCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Venue not found' });
    }

    try {
      await pool.query(
        `INSERT INTO venue_follows (user_id, venue_id, bell)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, venue_id) DO NOTHING`,
        [userId, venue_id, req.body?.bell === true]
      );
    } catch (_e) {
      await pool.query(
        `INSERT INTO venue_follows (user_id, venue_id)
         VALUES ($1, $2)
         ON CONFLICT (user_id, venue_id) DO NOTHING`,
        [userId, venue_id]
      );
    }

    const venue = venueCheck.rows[0];
    const isVerified = await getVenueVerified(venue.name, venue.city);

    res.status(201).json({
      success: true,
      message: 'Venue followed',
      data: {
        venue_id: venue_id,
        venue_name: venue.name,
        venue_city: venue.city,
        is_verified: isVerified,
      },
    });
  } catch (error) {
    logger.error('Error following venue', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to follow venue' });
  }
});

// GET /api/venue-follows/:venueId/status
router.get('/:venueId/status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId;
    const r = await pool.query(
      `SELECT COALESCE(bell, false) AS bell FROM venue_follows
       WHERE user_id = $1 AND venue_id = $2 LIMIT 1`,
      [userId, req.params.venueId]
    );
    return res.json({
      success: true,
      data: {
        is_following: r.rows.length > 0,
        bell: r.rows[0] ? Boolean(r.rows[0].bell) : false,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to check venue follow' });
  }
});

// PATCH /api/venue-follows/:venueId/bell — zil 🔔
router.patch('/:venueId/bell', authenticateToken, async (req, res) => {
  try {
    const bell = req.body.bell === true;
    const r = await pool.query(
      `UPDATE venue_follows SET bell = $3
       WHERE user_id = $1 AND venue_id = $2
       RETURNING *`,
      [req.user.userId, req.params.venueId, bell]
    );
    if (!r.rows[0]) {
      return res.status(404).json({ success: false, error: 'Follow not found — önce takip et' });
    }
    return res.json({ success: true, data: r.rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to update bell' });
  }
});

// DELETE /api/venue-follows/:venueId - Unfollow a venue
router.delete('/:venueId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { venueId } = req.params;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const result = await pool.query(
      `DELETE FROM venue_follows WHERE user_id = $1 AND venue_id = $2 RETURNING id`,
      [userId, venueId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Follow relationship not found' });
    }

    res.json({ success: true, message: 'Venue unfollowed' });
  } catch (error) {
    logger.error('Error unfollowing venue', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to unfollow venue' });
  }
});

export default router;
