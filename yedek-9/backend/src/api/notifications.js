import express from 'express';
import pool from '../config/database.js';
import logger from '../utils/logger.js';
import {
  registerDeviceToken,
  unregisterDeviceToken,
  getUserDeviceTokens,
} from '../services/notifications.js';
import { authenticateToken } from './auth.js';

const router = express.Router();

// POST /api/notifications/register - Register device token
router.post('/register', authenticateToken, async (req, res) => {
  try {
    const { token, platform = 'ios' } = req.body;
    const userId = req.user.userId;

    if (!userId || !token) {
      return res.status(400).json({
        success: false,
      error: 'token is required'
      });
    }

    const validPlatforms = ['ios', 'android', 'web'];
    if (!validPlatforms.includes(platform)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid platform. Must be ios, android, or web'
      });
    }

    const result = await registerDeviceToken(userId, token, platform);

    if (result.success) {
      res.json({
        success: true,
        message: 'Device token registered'
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Failed to register device token'
      });
    }
  } catch (error) {
    logger.error('Error registering device token', { 
      error: error.message, 
      stack: error.stack 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to register device token'
    });
  }
});

// DELETE /api/notifications/unregister - Unregister device token
router.delete('/unregister', authenticateToken, async (req, res) => {
  try {
    const { token } = req.body;
    const userId = req.user.userId;

    if (!userId || !token) {
      return res.status(400).json({
        success: false,
      error: 'token is required'
      });
    }

    const result = await unregisterDeviceToken(userId, token);

    if (result.success) {
      res.json({
        success: true,
        message: 'Device token unregistered'
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Failed to unregister device token'
      });
    }
  } catch (error) {
    logger.error('Error unregistering device token', { 
      error: error.message, 
      stack: error.stack 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to unregister device token'
    });
  }
});

// GET /api/notifications - Get user's notifications
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { limit = 50, unread_only = false } = req.query;
    const userId = req.user.userId;

    let query = `
      SELECT 
        id,
        type,
        title,
        body,
        data,
        read,
        created_at
      FROM notifications
      WHERE user_id = $1
    `;

    const params = [userId];

    if (unread_only === 'true') {
      query += ' AND read = false';
    }

    query += ' ORDER BY created_at DESC LIMIT $2';
    params.push(parseInt(limit));

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows.map(row => ({
        id: row.id,
        type: row.type,
        title: row.title,
        body: row.body,
        data: row.data,
        read: row.read,
        created_at: row.created_at,
      }))
    });
  } catch (error) {
    logger.error('Error fetching notifications', { 
      error: error.message, 
      stack: error.stack 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch notifications'
    });
  }
});

// PATCH /api/notifications/:id/read - Mark notification as read
router.patch('/:id/read', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const result = await pool.query(
      `UPDATE notifications 
       SET read = true 
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Error marking notification as read', { 
      error: error.message, 
      stack: error.stack 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to mark notification as read'
    });
  }
});

// PATCH /api/notifications/read-all - Mark all notifications as read
router.patch('/read-all', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    await pool.query(
      `UPDATE notifications 
       SET read = true 
       WHERE user_id = $1 AND read = false`,
      [userId]
    );

    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    logger.error('Error marking all notifications as read', { 
      error: error.message, 
      stack: error.stack 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to mark all notifications as read'
    });
  }
});

export default router;
