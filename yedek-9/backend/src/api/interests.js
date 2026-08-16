import express from 'express';
import pool from '../config/database.js';
import { authenticateToken } from './auth.js';

const router = express.Router();

// GET /api/interests/:userId - Get user interests
router.get('/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    const query = `
      SELECT category
      FROM user_interests
      WHERE user_id = $1
      ORDER BY created_at ASC
    `;

    const result = await pool.query(query, [userId]);

    res.json({
      success: true,
      data: result.rows.map(row => row.category)
    });
  } catch (error) {
    console.error('Error fetching user interests:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user interests'
    });
  }
});

// POST /api/interests/:userId - Add interest to user (must be current user)
router.post('/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { category } = req.body;

    const currentUserId = String(req.user.userId);

    if (String(userId) !== currentUserId) {
      return res.status(403).json({
        success: false,
        error: 'Cannot modify interests for another user'
      });
    }

    if (!category) {
      return res.status(400).json({
        success: false,
        error: 'category is required'
      });
    }

    // Check if user exists
    const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Insert interest (ignore if already exists due to UNIQUE constraint)
    const result = await pool.query(
      `INSERT INTO user_interests (user_id, category)
       VALUES ($1, $2)
       ON CONFLICT (user_id, category) DO NOTHING
       RETURNING *`,
      [userId, category.toLowerCase().trim()]
    );

    if (result.rows.length === 0) {
      // Already exists
      return res.json({
        success: true,
        data: { category, message: 'Interest already exists' }
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error adding user interest:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add user interest'
    });
  }
});

// DELETE /api/interests/:userId/:category - Remove interest from user
router.delete('/:userId/:category', authenticateToken, async (req, res) => {
  try {
    const { userId, category } = req.params;

    const currentUserId = String(req.user.userId);

    if (String(userId) !== currentUserId) {
      return res.status(403).json({
        success: false,
        error: 'Cannot modify interests for another user'
      });
    }

    const result = await pool.query(
      `DELETE FROM user_interests 
       WHERE user_id = $1 AND category = $2
       RETURNING *`,
      [userId, category.toLowerCase().trim()]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Interest not found'
      });
    }

    res.json({
      success: true,
      message: 'Interest removed'
    });
  } catch (error) {
    console.error('Error removing user interest:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove user interest'
    });
  }
});

// GET /api/interests/:userId/shared/:viewerId - Get shared interests between two users
router.get('/:userId/shared/:viewerId', authenticateToken, async (req, res) => {
  try {
    const { userId, viewerId } = req.params;

    const currentUserId = String(req.user.userId);
    if (String(viewerId) !== currentUserId) {
      return res.status(403).json({
        success: false,
        error: 'viewerId must match authenticated user'
      });
    }

    const query = `
      SELECT ui1.category
      FROM user_interests ui1
      INNER JOIN user_interests ui2 ON ui1.category = ui2.category
      WHERE ui1.user_id = $1 AND ui2.user_id = $2
      ORDER BY ui1.category ASC
    `;

    const result = await pool.query(query, [userId, viewerId]);

    res.json({
      success: true,
      data: result.rows.map(row => row.category)
    });
  } catch (error) {
    console.error('Error fetching shared interests:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch shared interests'
    });
  }
});

export default router;
