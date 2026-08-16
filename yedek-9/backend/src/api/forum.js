import express from 'express';
import { authenticateToken } from './auth.js';
import {
  listCommentableTargets,
  createForumComment,
  voteForumComment,
  listForumComments,
  createPulseRepost,
  listActivePulseReposts,
  listRitualReposts,
} from '../services/forumService.js';

const router = express.Router();

// GET /api/forum/rituals/:ritualId/targets
router.get('/rituals/:ritualId/targets', authenticateToken, async (req, res) => {
  try {
    const result = await listCommentableTargets(req.params.ritualId, req.user.userId);
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, error: result.error });
    }
    return res.json({
      success: true,
      ritual: {
        id: result.ritual.id,
        title: result.ritual.title,
        window_type: result.ritual.window_type,
        forum_surface: result.ritual.forum_surface,
        repost_count: result.ritual.repost_count,
      },
      targets: result.targets,
    });
  } catch (e) {
    console.error('forum targets:', e);
    return res.status(500).json({ success: false, error: 'Failed to load forum targets' });
  }
});

// GET /api/forum/rituals/:ritualId/comments
router.get('/rituals/:ritualId/comments', authenticateToken, async (req, res) => {
  try {
    const { target_type, target_id } = req.query;
    const result = await listForumComments(req.params.ritualId, req.user.userId, {
      targetType: target_type,
      targetId: target_id,
    });
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, error: result.error });
    }
    return res.json({ success: true, data: result.comments });
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Failed to list comments' });
  }
});

// POST /api/forum/rituals/:ritualId/comments
router.post('/rituals/:ritualId/comments', authenticateToken, async (req, res) => {
  try {
    const { target_type, target_id, parent_id, content } = req.body;
    const result = await createForumComment({
      ritualId: req.params.ritualId,
      userId: req.user.userId,
      targetType: target_type,
      targetId: target_id,
      parentId: parent_id,
      content,
    });
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, error: result.error });
    }
    return res.status(201).json({ success: true, data: result.comment });
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Failed to create comment' });
  }
});

// POST /api/forum/comments/:commentId/vote
router.post('/comments/:commentId/vote', authenticateToken, async (req, res) => {
  try {
    const { vote } = req.body;
    const result = await voteForumComment(req.params.commentId, req.user.userId, vote);
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, error: result.error });
    }
    return res.json({ success: true, data: result });
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Failed to vote' });
  }
});

// GET /api/forum/rituals/:ritualId/reposts — ritual repost list (son-part.md §1)
router.get('/rituals/:ritualId/reposts', authenticateToken, async (req, res) => {
  try {
    const rows = await listRitualReposts(req.params.ritualId, { limit: req.query.limit });
    return res.json({ success: true, data: rows });
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Failed to list ritual reposts' });
  }
});

// POST /api/forum/rituals/:ritualId/repost — forum → Pulse (24h)
router.post('/rituals/:ritualId/repost', authenticateToken, async (req, res) => {
  try {
    const { comment_id, memory_id } = req.body;
    const result = await createPulseRepost({
      ritualId: req.params.ritualId,
      userId: req.user.userId,
      commentId: comment_id,
      memoryId: memory_id,
    });
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, error: result.error });
    }
    return res.status(201).json({ success: true, data: result.repost });
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Failed to repost' });
  }
});

// GET /api/forum/reposts/pulse — aktif repost akışı
router.get('/reposts/pulse', authenticateToken, async (req, res) => {
  try {
    const rows = await listActivePulseReposts(req.user.userId, {
      limit: req.query.limit,
      surface: req.query.surface || 'your_pulse',
    });
    return res.json({ success: true, data: rows });
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Failed to list reposts' });
  }
});

export default router;
