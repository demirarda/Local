import express from 'express';
import { authenticateToken } from './auth.js';
import { sendShareObject, listShareObjects, listShareInbox, listShareableObjects } from '../services/shareService.js';

const router = express.Router();

// GET /api/share/shareable — paylaşılabilir nesneler (PUBLIC only)
router.get('/shareable', authenticateToken, async (req, res) => {
  try {
    const { type = 'memory', limit } = req.query;
    const result = await listShareableObjects(req.user.userId, { type, limit });
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, error: result.error });
    }
    return res.json({ success: true, data: result.objects });
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Failed to list shareable objects' });
  }
});

// GET /api/share?with_user_id= — Share-2-Person geçmişi (arkadaş)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const withUserId = req.query.with_user_id;
    if (!withUserId) {
      const inbox = await listShareInbox(req.user.userId, { limit: req.query.limit });
      return res.json({ success: true, data: inbox });
    }
    const result = await listShareObjects(req.user.userId, withUserId, { limit: req.query.limit });
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, error: result.error });
    }
    return res.json({ success: true, data: result.shares });
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Failed to fetch shares' });
  }
});

// POST /api/share — nesne paylaşımı (not tek başına yasak)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { to_user_id, object_type, object_id, note, payload } = req.body;
    if (!to_user_id) {
      return res.status(400).json({ success: false, error: 'to_user_id is required' });
    }
    const result = await sendShareObject({
      fromUserId: req.user.userId,
      toUserId: to_user_id,
      objectType: object_type,
      objectId: object_id,
      note,
      payload,
    });
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, error: result.error });
    }
    return res.status(201).json({ success: true, data: result.share });
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Failed to send share' });
  }
});

export default router;
