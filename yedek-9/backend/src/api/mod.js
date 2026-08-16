import express from 'express';
import { authenticateToken, requireAdmin } from './auth.js';
import {
  createReport,
  applyModAction,
  listModQueue,
  answerHostWitness,
  createAppeal,
  resolveAppeal,
  createLocationShare,
  sanctionFalseReporter,
} from '../services/modEngine.js';
import { t } from '../i18n/stringTable.js';
import { REPORT_CATEGORIES, REPORT_SURFACES } from '../services/modSurfaces.js';

const router = express.Router();

/** GET kategori string tablosu (panel açmak iz bırakmaz — bu endpoint log'lanmaz). */
router.get('/categories', authenticateToken, async (req, res) => {
  const lang = String(req.query.lang || 'tr').toLowerCase() === 'en' ? 'en' : 'tr';
  res.json({
    success: true,
    data: REPORT_CATEGORIES.map((key) => ({
      key,
      label: t(key, lang),
    })),
  });
});

router.get('/report-surfaces', authenticateToken, async (_req, res) => {
  return res.json({ success: true, data: REPORT_SURFACES });
});

router.get('/acceptance', authenticateToken, async (_req, res) => {
  const { MOD_IRON_RULES, LIVE_SAFETY_ACTIONS } = await import('../services/modSurfaces.js');
  const { getCsamReadiness } = await import('../services/csamScanner.js');
  const csam = getCsamReadiness();
  return res.json({
    success: true,
    data: {
      surfaces: REPORT_SURFACES,
      surface_count: REPORT_SURFACES.length,
      categories: REPORT_CATEGORIES,
      live_safety_actions: LIVE_SAFETY_ACTIONS,
      iron_rules: MOD_IRON_RULES,
      csam_status: csam.status,
      csam_provider: csam.provider,
      csam_live: csam.live,
      csam_hold_enforced: true,
    },
  });
});

router.get('/csam-readiness', authenticateToken, async (_req, res) => {
  const { getCsamReadiness } = await import('../services/csamScanner.js');
  return res.json({ success: true, data: getCsamReadiness() });
});

router.post('/reports', authenticateToken, async (req, res) => {
  try {
    const body = req.body || {};
    const report = await createReport({
      reporterId: req.user.userId,
      targetType: body.target_type || body.report_type || body.targetType,
      targetId: body.target_id || body.reported_id || body.targetId || null,
      ritualId: body.ritual_id || body.ritualId || null,
      categoryKey: body.category_key || body.categoryKey || body.reason || null,
      leaveAfter: Boolean(body.leave_after ?? body.leaveAfter),
      description: body.description || null,
      packageData: body.package_data || body.packageData || {},
      queueLane: body.queue_lane || null,
    });
    res.status(201).json({ success: true, data: report });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/reports', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const rows = await listModQueue({
      status: req.query.status || 'queued',
      limit: Math.min(Number(req.query.limit) || 50, 100),
      offset: Number(req.query.offset) || 0,
    });
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/reports/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const pool = (await import('../config/database.js')).default;
    const r = await pool.query(
      `SELECT mr.*,
              hw.id AS witness_id, hw.host_id, hw.answer AS witness_answer, hw.answered_at AS witness_answered_at
       FROM mod_reports mr
       LEFT JOIN mod_host_witness hw ON hw.report_id = mr.id
       WHERE mr.id = $1`,
      [req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: r.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/actions', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const action = await applyModAction({
      reportId: req.body.report_id,
      level: req.body.level,
      targetUserId: req.body.target_user_id,
      secondModeratorId: req.body.second_moderator_id,
      founderApproved: Boolean(req.body.founder_approved),
      founderUserId: req.user.userId,
      note: req.body.note || null,
      contentAction: req.body.content_action || null,
      rsDeltaOverride: req.body.rs_delta ?? null,
      forceBelowThreshold: Boolean(req.body.force_below_threshold),
      moderatorId: req.user.userId,
    });
    res.json({ success: true, data: action });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/false-reporter', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const action = await sanctionFalseReporter({
      reporterId: req.body.reporter_id,
      moderatorId: req.user.userId,
      secondModeratorId: req.body.second_moderator_id,
      escalate: Boolean(req.body.escalate),
    });
    res.json({ success: true, data: action });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/host-witness/:reportId', authenticateToken, async (req, res) => {
  try {
    const row = await answerHostWitness({
      reportId: req.params.reportId,
      hostId: req.user.userId,
      answer: req.body.answer,
    });
    res.json({ success: true, data: row });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/host-witness/pending', authenticateToken, async (req, res) => {
  try {
    const pool = (await import('../config/database.js')).default;
    const r = await pool.query(
      `SELECT hw.*, mr.ritual_id, mr.category_key, mr.target_type
       FROM mod_host_witness hw
       JOIN mod_reports mr ON mr.id = hw.report_id
       WHERE hw.host_id = $1 AND hw.answer IS NULL
       ORDER BY hw.created_at DESC
       LIMIT 20`,
      [req.user.userId]
    );
    res.json({ success: true, data: r.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** Check-in C1–C5 funnel özeti (admin) — LOCAL_CheckIn_Sistemi §8 */
router.get('/checkin-funnel', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { getCheckinFunnelSummary } = await import('../services/checkinFunnelService.js');
    const days = Number(req.query.days) || 7;
    const includeOps = req.query.include_ops !== '0';
    const summary = await getCheckinFunnelSummary({
      days,
      includePendingMap: true,
      includeOps,
    });
    if (!summary.ok) {
      return res.status(503).json({ success: false, error: summary.error || 'funnel_unavailable' });
    }
    return res.json({ success: true, data: summary });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.patch('/totem-ops/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { updateTotemOpsStatus } = await import('../services/checkinFunnelService.js');
    const result = await updateTotemOpsStatus(req.params.id, req.body?.status);
    if (!result.ok) {
      const code = result.error === 'not_found' ? 404 : 400;
      return res.status(code).json({ success: false, error: result.error });
    }
    return res.json({ success: true, data: result.row });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/checkin-field-notes', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { listCheckinFieldNotes } = await import('../services/checkinFunnelService.js');
    const result = await listCheckinFieldNotes({ limit: Number(req.query.limit) || 40 });
    if (!result.ok) {
      return res.status(503).json({ success: false, error: result.error });
    }
    return res.json({ success: true, data: result.rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/checkin-field-notes', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { createCheckinFieldNote } = await import('../services/checkinFunnelService.js');
    const result = await createCheckinFieldNote({
      ritualId: req.body?.ritual_id || null,
      venueId: req.body?.venue_id || null,
      authorId: req.user.userId,
      checklistKey: req.body?.checklist_key,
      note: req.body?.note,
    });
    if (!result.ok) {
      return res.status(400).json({ success: false, error: result.error });
    }
    return res.json({ success: true, data: result.row });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/sanctions/me', authenticateToken, async (req, res) => {
  try {
    const pool = (await import('../config/database.js')).default;
    const r = await pool.query(
      `SELECT s.*, a.id AS action_id, a.level AS action_level, a.note
       FROM mod_sanctions s
       LEFT JOIN mod_actions a ON a.id = s.action_id
       WHERE s.user_id = $1 AND s.active = true
         AND (s.ends_at IS NULL OR s.ends_at > NOW())
       ORDER BY s.created_at DESC`,
      [req.user.userId]
    );
    res.json({ success: true, data: r.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/appeals', authenticateToken, async (req, res) => {
  try {
    const appeal = await createAppeal({
      actionId: req.body.action_id,
      appellantId: req.user.userId,
      reason: req.body.reason,
    });
    res.status(201).json({ success: true, data: appeal });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/appeals/:id/resolve', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const row = await resolveAppeal({
      appealId: req.params.id,
      reviewerId: req.user.userId,
      decision: req.body.decision,
      decisionNote: req.body.decision_note,
    });
    res.json({ success: true, data: row });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/appeals', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const pool = (await import('../config/database.js')).default;
    const r = await pool.query(
      `SELECT * FROM mod_appeals
       WHERE ($1::text IS NULL OR status = $1)
       ORDER BY created_at DESC LIMIT 50`,
      [req.query.status || 'pending']
    );
    res.json({ success: true, data: r.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/location-share', authenticateToken, async (req, res) => {
  try {
    const row = await createLocationShare({
      sharerId: req.user.userId,
      friendId: req.body.friend_id,
      ritualId: req.body.ritual_id || null,
    });
    res.status(201).json({ success: true, data: row });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

export default router;
