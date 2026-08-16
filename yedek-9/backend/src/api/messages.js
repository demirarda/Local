import express from 'express';
import { authenticateToken } from './auth.js';

const router = express.Router();

/**
 * Legacy /api/messages — düz metin DM yok (sonMD).
 * Share-2-Person → /api/share · Friends-DM → /api/friends-dm (F1.5 410).
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user.userId;
    const withUserId = req.query.with_user_id;

    if (!withUserId) {
      return res.status(400).json({
        success: false,
        error: 'with_user_id is required. Use GET /api/share for Share-2-Person inbox.',
        friends_dm: '/api/friends-dm',
      });
    }

    const { listShareObjects } = await import('../services/shareService.js');
    const result = await listShareObjects(currentUserId, withUserId);
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, error: result.error });
    }

    return res.json({
      success: true,
      data: result.shares,
      deprecated: true,
      migrate_to: '/api/share',
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch conversation' });
  }
});

router.post('/', authenticateToken, async (_req, res) => {
  return res.status(410).json({
    success: false,
    error: 'Plain text DMs are disabled. Use POST /api/share. Friends-DM is F1.5.',
    code: 'PLAIN_DM_GONE',
    migrate_to: '/api/share',
    friends_dm: '/api/friends-dm',
  });
});

export default router;
