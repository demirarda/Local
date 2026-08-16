import express from 'express';
import rateLimit from 'express-rate-limit';
import pool from '../config/database.js';
import { authenticateToken, requireAdmin } from './auth.js';
import { logAdminAction } from '../utils/auditLog.js';

const router = express.Router();

const reportsRateLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => `user:${req.user?.userId || req.ip}`,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Daily report limit exceeded'
  }
});

// POST /api/safety/report - Report a user, ritual, message, or memory
// Protected: reporter is always the authenticated user
router.post('/report', authenticateToken, reportsRateLimiter, async (req, res) => {
  return res.status(410).json({
    success: false,
    error: 'Legacy safety report endpoint removed; use /api/mod/reports',
    code: 'USE_MOD_REPORTS',
  });
});

// Legacy implementation kept below for reference (unreachable)
router.post('/report-legacy-disabled', authenticateToken, reportsRateLimiter, async (req, res) => {
  try {
    const {
      reporter_id,
      reported_user_id,
      reported_ritual_id,
      ritual_id,
      report_type,
      reason,
      description
    } = req.body;
    const resolvedReportedRitualId = reported_ritual_id || ritual_id || null;
    const resolvedReportType = report_type || (resolvedReportedRitualId ? 'ritual' : 'user');

    const authUserId = req.user?.userId;

    if (!authUserId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    if (!reason) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: reason'
      });
    }

    // Validate report type
    const validTypes = ['user', 'ritual', 'message', 'memory'];
    if (!validTypes.includes(resolvedReportType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid report_type'
      });
    }

    // Validate based on report type
    if (resolvedReportType === 'user' && !reported_user_id) {
      return res.status(400).json({
        success: false,
        error: 'reported_user_id is required for user reports'
      });
    }

    // Prevent spoofing reporter_id if provided in body
    if (reporter_id && reporter_id !== authUserId) {
      return res.status(403).json({
        success: false,
        error: 'reporter_id does not match authenticated user'
      });
    }

    if (resolvedReportType === 'ritual' && !resolvedReportedRitualId) {
      return res.status(400).json({
        success: false,
        error: 'ritual_id is required for ritual reports'
      });
    }

    if (authUserId === reported_user_id) {
      return res.status(400).json({
        success: false,
        error: 'Cannot report yourself'
      });
    }

    // Insert report
    const result = await pool.query(
      `INSERT INTO reports (
        reporter_id, reported_user_id, reported_ritual_id,
        report_type, reason, description
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [
        authUserId,
        reported_user_id || null,
        resolvedReportedRitualId,
        resolvedReportType,
        reason,
        description || null
      ]
    );
    const reportId = result.rows[0].id;

    // Auto-moderation: profanity check (reason + description)
    const textToCheck = `${(reason || '')} ${(description || '')}`.toLowerCase();
    const profanityList = ['küfür', 'hakaret', 'spam', 'abuse', 'hate']; // extend as needed
    const hasProfanity = profanityList.some((word) => textToCheck.includes(word));
    if (hasProfanity) {
      await pool.query(
        'UPDATE reports SET status = $1, reviewed_at = CURRENT_TIMESTAMP WHERE id = $2',
        ['reviewed', reportId]
      );
      const updated = await pool.query('SELECT * FROM reports WHERE id = $1', [reportId]);
      return res.json({
        success: true,
        data: updated.rows[0],
        message: 'Report submitted successfully (auto-flagged for review)'
      });
    }

    // Auto-moderation: repeat reports — if 3+ pending for same user/ritual, mark all as reviewed
    const targetUserId = resolvedReportType === 'user' ? reported_user_id : null;
    const targetRitualId = resolvedReportType === 'ritual' ? resolvedReportedRitualId : null;
    if (targetUserId || targetRitualId) {
      const countResult = targetUserId
        ? await pool.query(
            'SELECT COUNT(*) AS c FROM reports WHERE status = $1 AND reported_user_id = $2',
            ['pending', targetUserId]
          )
        : await pool.query(
            'SELECT COUNT(*) AS c FROM reports WHERE status = $1 AND reported_ritual_id = $2',
            ['pending', targetRitualId]
          );
      const pendingCount = parseInt(countResult.rows[0]?.c || 0);
      if (pendingCount >= 3) {
        if (targetUserId) {
          await pool.query(
            "UPDATE reports SET status = 'reviewed', reviewed_at = CURRENT_TIMESTAMP WHERE status = 'pending' AND reported_user_id = $1",
            [targetUserId]
          );
        } else {
          await pool.query(
            "UPDATE reports SET status = 'reviewed', reviewed_at = CURRENT_TIMESTAMP WHERE status = 'pending' AND reported_ritual_id = $1",
            [targetRitualId]
          );
        }
        const updated = await pool.query('SELECT * FROM reports WHERE id = $1', [reportId]);
        return res.json({
          success: true,
          data: updated.rows[0],
          message: 'Report submitted successfully (multiple reports — auto-flagged for review)'
        });
      }
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Report submitted successfully'
    });
  } catch (error) {
    console.error('Error submitting report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit report'
    });
  }
});

// GET /api/safety/reports - List reports (admin only). Optional: reported_user_id, reported_ritual_id for drill-down.
router.get('/reports', authenticateToken, requireAdmin, async (req, res) => {
  return res.status(410).json({
    success: false,
    error: 'Legacy safety reports endpoint removed; use /api/mod/reports',
    code: 'USE_MOD_REPORTS',
  });
});

router.get('/reports-legacy-disabled', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status, report_type, limit = 50, offset = 0, reported_user_id, reported_ritual_id } = req.query;
    const validStatus = ['pending', 'reviewed', 'resolved', 'dismissed'];
    const statusFilter = status && validStatus.includes(status) ? status : null;
    const validReportType = ['user', 'ritual', 'message', 'memory'];
    const reportTypeFilter = report_type && validReportType.includes(report_type) ? report_type : null;
    const limitNum = Math.min(parseInt(limit) || 50, 100);
    const offsetNum = Math.max(0, parseInt(offset) || 0);

    const conditions = [];
    const params = [];
    let idx = 1;
    if (statusFilter) {
      conditions.push(`r.status = $${idx}`);
      params.push(statusFilter);
      idx++;
    }
    if (reportTypeFilter) {
      conditions.push(`r.report_type = $${idx}`);
      params.push(reportTypeFilter);
      idx++;
    }
    if (reported_user_id) {
      conditions.push(`r.reported_user_id = $${idx}`);
      params.push(reported_user_id);
      idx++;
    }
    if (reported_ritual_id) {
      conditions.push(`r.reported_ritual_id = $${idx}`);
      params.push(reported_ritual_id);
      idx++;
    }
    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(limitNum, offsetNum);

    const result = await pool.query(
      `SELECT r.id, r.reporter_id, r.reported_user_id, r.reported_ritual_id,
              r.report_type, r.reason, r.description, r.status, r.created_at,
              r.reviewed_at, r.reviewed_by, r.action_note,
              u1.name AS reporter_name, u2.name AS reported_user_name,
              rt.title AS reported_ritual_title,
              u3.name AS reviewed_by_name
       FROM reports r
       LEFT JOIN users u1 ON r.reporter_id = u1.id
       LEFT JOIN users u2 ON r.reported_user_id = u2.id
       LEFT JOIN rituals rt ON r.reported_ritual_id = rt.id
       LEFT JOIN users u3 ON r.reviewed_by = u3.id
       ${whereClause}
       ORDER BY r.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      params
    );

    let countQuery = 'SELECT COUNT(*) AS total FROM reports r';
    const countParams = [];
    const countConditions = [];
    if (statusFilter) {
      countConditions.push(`r.status = $${countParams.length + 1}`);
      countParams.push(statusFilter);
    }
    if (reportTypeFilter) {
      countConditions.push(`r.report_type = $${countParams.length + 1}`);
      countParams.push(reportTypeFilter);
    }
    if (reported_user_id) {
      countConditions.push(`r.reported_user_id = $${countParams.length + 1}`);
      countParams.push(reported_user_id);
    }
    if (reported_ritual_id) {
      countConditions.push(`r.reported_ritual_id = $${countParams.length + 1}`);
      countParams.push(reported_ritual_id);
    }
    if (countConditions.length) countQuery += ` WHERE ${countConditions.join(' AND ')}`;
    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0]?.total || 0);

    res.json({
      success: true,
      data: result.rows,
      total,
    });
  } catch (error) {
    console.error('Error listing reports:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list reports',
    });
  }
});

// PATCH /api/safety/reports/:id - Resolve/dismiss a report (admin only)
router.patch('/reports/:id', authenticateToken, requireAdmin, async (req, res) => {
  return res.status(410).json({
    success: false,
    error: 'Legacy safety report review endpoint removed; use /api/mod/actions',
    code: 'USE_MOD_ACTIONS',
  });
});

router.patch('/reports-legacy-disabled/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status: newStatus, action_note } = req.body;
    const authUserId = req.user?.userId;

    if (!['resolved', 'dismissed', 'reviewed'].includes(newStatus)) {
      return res.status(400).json({
        success: false,
        error: 'status must be one of: resolved, dismissed, reviewed',
      });
    }

    const result = await pool.query(
      `UPDATE reports
       SET status = $1, reviewed_at = CURRENT_TIMESTAMP, reviewed_by = $2, action_note = $4
       WHERE id = $3
       RETURNING *`,
      [newStatus, authUserId, id, action_note || null]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Report not found',
      });
    }

    if (newStatus === 'dismissed') {
      try {
        const reporterId = result.rows[0]?.reporter_id;
        if (reporterId) {
          // v2 §5: dismiss RS'e dokunmaz — asılsız raporcu L1 (MOD path)
          const { sanctionFalseReporter } = await import('../services/modEngine.js');
          await sanctionFalseReporter({
            reporterId,
            moderatorId: authUserId,
            escalate: false,
          });
        }
      } catch (penaltyError) {
        console.error('Failed to apply false report L1 sanction:', penaltyError.message);
      }
    }

    await logAdminAction(pool, {
      adminUserId: authUserId,
      action: 'report_status_update',
      targetType: 'report',
      targetId: id,
      details: { status: newStatus, action_note: action_note || undefined },
    });

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error updating report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update report',
    });
  }
});

// ---------- Admin: suspend / unsuspend (require ADMIN_USER_IDS in env) ----------
// POST /api/safety/admin/suspend-user
router.post('/admin/suspend-user', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { user_id } = req.body;
    if (!user_id) {
      return res.status(400).json({ success: false, error: 'user_id required' });
    }
    await pool.query(
      'UPDATE users SET suspended_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [user_id]
    );
    const r = await pool.query('SELECT id, name, suspended_at FROM users WHERE id = $1', [user_id]);
    if (r.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    await logAdminAction(pool, {
      adminUserId: req.user?.userId,
      action: 'suspend_user',
      targetType: 'user',
      targetId: user_id,
    });
    res.json({ success: true, data: r.rows[0], message: 'User suspended' });
  } catch (error) {
    console.error('Error suspending user:', error);
    res.status(500).json({ success: false, error: 'Failed to suspend user' });
  }
});

// POST /api/safety/admin/unsuspend-user
router.post('/admin/unsuspend-user', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { user_id } = req.body;
    if (!user_id) {
      return res.status(400).json({ success: false, error: 'user_id required' });
    }
    await pool.query('UPDATE users SET suspended_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [user_id]);
    const r = await pool.query('SELECT id, name, suspended_at FROM users WHERE id = $1', [user_id]);
    if (r.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    await logAdminAction(pool, {
      adminUserId: req.user?.userId,
      action: 'unsuspend_user',
      targetType: 'user',
      targetId: user_id,
    });
    res.json({ success: true, data: r.rows[0], message: 'User unsuspended' });
  } catch (error) {
    console.error('Error unsuspending user:', error);
    res.status(500).json({ success: false, error: 'Failed to unsuspend user' });
  }
});

// POST /api/safety/admin/suspend-ritual
router.post('/admin/suspend-ritual', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { ritual_id } = req.body;
    if (!ritual_id) {
      return res.status(400).json({ success: false, error: 'ritual_id required' });
    }
    await pool.query(
      'UPDATE rituals SET suspended_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [ritual_id]
    );
    const r = await pool.query('SELECT id, title, suspended_at FROM rituals WHERE id = $1', [ritual_id]);
    if (r.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Ritual not found' });
    }
    await logAdminAction(pool, {
      adminUserId: req.user?.userId,
      action: 'suspend_ritual',
      targetType: 'ritual',
      targetId: ritual_id,
    });
    res.json({ success: true, data: r.rows[0], message: 'Ritual suspended' });
  } catch (error) {
    console.error('Error suspending ritual:', error);
    res.status(500).json({ success: false, error: 'Failed to suspend ritual' });
  }
});

// POST /api/safety/admin/unsuspend-ritual
router.post('/admin/unsuspend-ritual', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { ritual_id } = req.body;
    if (!ritual_id) {
      return res.status(400).json({ success: false, error: 'ritual_id required' });
    }
    await pool.query('UPDATE rituals SET suspended_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [ritual_id]);
    const r = await pool.query('SELECT id, title, suspended_at FROM rituals WHERE id = $1', [ritual_id]);
    if (r.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Ritual not found' });
    }
    await logAdminAction(pool, {
      adminUserId: req.user?.userId,
      action: 'unsuspend_ritual',
      targetType: 'ritual',
      targetId: ritual_id,
    });
    res.json({ success: true, data: r.rows[0], message: 'Ritual unsuspended' });
  } catch (error) {
    console.error('Error unsuspending ritual:', error);
    res.status(500).json({ success: false, error: 'Failed to unsuspend ritual' });
  }
});

// POST /api/safety/admin/suspend-users - Batch suspend users (admin only)
router.post('/admin/suspend-users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { user_ids: userIds } = req.body;
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ success: false, error: 'user_ids array required' });
    }
    const adminUserId = req.user?.userId;
    const suspended = [];
    for (const user_id of userIds) {
      if (!user_id) continue;
      await pool.query(
        'UPDATE users SET suspended_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [user_id]
      );
      const r = await pool.query('SELECT id, name FROM users WHERE id = $1', [user_id]);
      if (r.rows.length > 0) {
        suspended.push(r.rows[0]);
        await logAdminAction(pool, { adminUserId, action: 'suspend_user', targetType: 'user', targetId: user_id });
      }
    }
    res.json({ success: true, data: suspended, message: `${suspended.length} kullanıcı askıya alındı` });
  } catch (error) {
    console.error('Error batch suspending users:', error);
    res.status(500).json({ success: false, error: 'Failed to suspend users' });
  }
});

// POST /api/safety/admin/suspend-rituals - Batch suspend rituals (admin only)
router.post('/admin/suspend-rituals', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { ritual_ids: ritualIds } = req.body;
    if (!Array.isArray(ritualIds) || ritualIds.length === 0) {
      return res.status(400).json({ success: false, error: 'ritual_ids array required' });
    }
    const adminUserId = req.user?.userId;
    const suspended = [];
    for (const ritual_id of ritualIds) {
      if (!ritual_id) continue;
      await pool.query(
        'UPDATE rituals SET suspended_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [ritual_id]
      );
      const r = await pool.query('SELECT id, title FROM rituals WHERE id = $1', [ritual_id]);
      if (r.rows.length > 0) {
        suspended.push(r.rows[0]);
        await logAdminAction(pool, { adminUserId, action: 'suspend_ritual', targetType: 'ritual', targetId: ritual_id });
      }
    }
    res.json({ success: true, data: suspended, message: `${suspended.length} Ritual askıya alındı` });
  } catch (error) {
    console.error('Error batch suspending rituals:', error);
    res.status(500).json({ success: false, error: 'Failed to suspend rituals' });
  }
});

// POST /api/safety/block - Block a user
// Protected: blocker is always the authenticated user
router.post('/block', authenticateToken, async (req, res) => {
  try {
    const { blocker_id, blocked_user_id } = req.body;

    const authUserId = req.user?.userId;

    if (!authUserId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    if (!blocked_user_id) {
      return res.status(400).json({
        success: false,
        error: 'blocked_user_id is required'
      });
    }

    // Prevent spoofing blocker_id if provided in body
    if (blocker_id && blocker_id !== authUserId) {
      return res.status(403).json({
        success: false,
        error: 'blocker_id does not match authenticated user'
      });
    }

    if (authUserId === blocked_user_id) {
      return res.status(400).json({
        success: false,
        error: 'Cannot block yourself'
      });
    }

    // Check if already blocked
    const existing = await pool.query(
      'SELECT * FROM blocks WHERE blocker_id = $1 AND blocked_user_id = $2',
      [authUserId, blocked_user_id]
    );

    if (existing.rows.length > 0) {
      return res.json({
        success: true,
        data: existing.rows[0],
        message: 'User already blocked'
      });
    }

    // Insert block
    const result = await pool.query(
      `INSERT INTO blocks (blocker_id, blocked_user_id)
       VALUES ($1, $2)
       RETURNING *`,
      [authUserId, blocked_user_id]
    );

    res.json({
      success: true,
      data: result.rows[0],
      message: 'User blocked successfully'
    });
  } catch (error) {
    console.error('Error blocking user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to block user'
    });
  }
});

// DELETE /api/safety/block/:blockedUserId - Unblock a user
// Protected: blocker is always the authenticated user
router.delete('/block/:blockedUserId', authenticateToken, async (req, res) => {
  try {
    const { blockedUserId } = req.params;
    const { blocker_id } = req.query;

    const authUserId = req.user?.userId;

    if (!authUserId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Prevent spoofing blocker_id if provided in query
    if (blocker_id && blocker_id !== authUserId) {
      return res.status(403).json({
        success: false,
        error: 'blocker_id does not match authenticated user'
      });
    }

    // Delete block
    const result = await pool.query(
      `DELETE FROM blocks 
       WHERE blocker_id = $1 AND blocked_user_id = $2
       RETURNING *`,
      [authUserId, blockedUserId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Block not found'
      });
    }

    res.json({
      success: true,
      message: 'User unblocked successfully'
    });
  } catch (error) {
    console.error('Error unblocking user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to unblock user'
    });
  }
});

// GET /api/safety/blocked - Get blocked users
// Protected: blocker is always the authenticated user
router.get('/blocked', authenticateToken, async (req, res) => {
  try {
    const { blocker_id } = req.query;

    const authUserId = req.user?.userId;

    if (!authUserId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Prevent spoofing blocker_id if provided in query
    if (blocker_id && blocker_id !== authUserId) {
      return res.status(403).json({
        success: false,
        error: 'blocker_id does not match authenticated user'
      });
    }

    const result = await pool.query(
      `SELECT 
        b.*,
        u.name as blocked_user_name,
        u.city as blocked_user_city,
        u.avatar_url as blocked_user_avatar_url
      FROM blocks b
      JOIN users u ON b.blocked_user_id = u.id
      WHERE b.blocker_id = $1
      ORDER BY b.created_at DESC`,
      [authUserId]
    );

    const baseUrl = process.env.API_PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
    const buildAvatar = (path) => {
      if (!path) return null;
      if (path.startsWith('http')) return path;
      return `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
    };

    res.json({
      success: true,
      data: result.rows.map(row => ({
        id: row.id,
        blocked_user: {
          id: row.blocked_user_id,
          name: row.blocked_user_name,
          city: row.blocked_user_city,
          avatar_url: buildAvatar(row.blocked_user_avatar_url),
        },
        created_at: row.created_at,
      }))
    });
  } catch (error) {
    console.error('Error fetching blocked users:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch blocked users'
    });
  }
});

// POST /api/safety/emergency-exit - Emergency exit from ritual
// Protected: user_id must match authenticated user
router.post('/emergency-exit', authenticateToken, async (req, res) => {
  try {
    const { ritual_id, user_id } = req.body;

    const authUserId = req.user?.userId;

    if (!authUserId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    if (!ritual_id || !user_id) {
      return res.status(400).json({
        success: false,
        error: 'ritual_id and user_id are required'
      });
    }

    if (user_id !== authUserId) {
      return res.status(403).json({
        success: false,
        error: 'user_id does not match authenticated user'
      });
    }

    // Mark emergency early leave + penalty-free cancel (v2 §5 Yardım)
    const result = await pool.query(
      `UPDATE ritual_attendance
       SET left_early_at = CURRENT_TIMESTAMP
       WHERE ritual_id = $1 AND user_id = $2
       RETURNING *`,
      [ritual_id, authUserId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Attendance record not found'
      });
    }

    try {
      const { cancelAttendancePenaltyFree } = await import('../services/penaltyService.js');
      await cancelAttendancePenaltyFree(ritual_id, authUserId);
    } catch (e) {
      console.warn('penalty-free emergency exit fallback:', e?.message || e);
    }

    try {
      const { maybeEnqueueSilentExitReview } = await import('../services/modEngine.js');
      await maybeEnqueueSilentExitReview(authUserId, ritual_id);
    } catch (e) {
      console.warn('silent-exit pattern check failed:', e?.message || e);
    }

    console.log(`Emergency exit: User ${authUserId} left ritual ${ritual_id} at ${new Date().toISOString()}`);

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Emergency exit successful'
    });
  } catch (error) {
    console.error('Error processing emergency exit:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process emergency exit'
    });
  }
});

export default router;
