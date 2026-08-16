import express from 'express';
import pool from '../config/database.js';
import { authenticateToken } from './auth.js';
import { requireIdentityVerified } from '../middleware/identityGate.js';
import {
  processCheckIn,
  approveManualCheckIn,
} from '../services/checkinService.js';
import { processAttendanceCancel } from '../services/penaltyService.js';
import LOCAL_CONFIG from '../config/localConfig.js';
import logger from '../utils/logger.js';

const router = express.Router();

// POST /api/attendance/checkin - Check in to a ritual
router.post('/checkin', authenticateToken, requireIdentityVerified, async (req, res) => {
  try {
    const {
      ritual_id,
      checkin_keyword,
      check_in_keyword,
      latitude,
      longitude,
      nfc_marker: nfcMarker,
      open_note: openNote,
      mock_location: mockLocation,
      play_integrity: playIntegrity,
      app_attest: appAttest,
      root,
      location_suspect: locationSuspect,
      digital_paste: digitalPaste,
      local_tag_redeem: localTagRedeem,
      entry_ms: entryMs,
    } = req.body;
    const rawKw = checkin_keyword ?? check_in_keyword ?? req.body.host_keyword ?? req.body.checkin_code;
    const userId = req.user.userId;
    // Totem/marker kimliği: şema izi yok, ops/MOD için iz kaydı
    const nfcTagId =
      typeof req.body?.nfc_tag_id === 'string' ? req.body.nfc_tag_id.trim().slice(0, 64) : null;

    if (!ritual_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: ritual_id',
      });
    }

    const result = await processCheckIn({
      ritualId: ritual_id,
      userId,
      latitude,
      longitude,
      keyword: rawKw,
      nfcMarker: Boolean(nfcMarker),
      localTagRedeem: Boolean(localTagRedeem),
      openNote: typeof openNote === 'string' ? openNote.trim().slice(0, 280) : null,
      locationSuspect: Boolean(locationSuspect) || Boolean(mockLocation),
      digitalPaste: Boolean(digitalPaste),
      entryMs: entryMs != null ? Number(entryMs) : null,
      gateMs: req.body.gate_ms != null ? Number(req.body.gate_ms) : null,
      culturePath: req.body.culture_path || null,
      integritySignals: {
        mock_location: Boolean(mockLocation),
        play_integrity: playIntegrity === false ? false : undefined,
        app_attest: appAttest === false ? false : undefined,
        root: root === true,
      },
    });

    if (!result.ok) {
      return res.status(result.status).json(result.body);
    }

    if (nfcMarker) {
      logger.info('Totem check-in', {
        ritual_id,
        user_id: userId,
        nfc_tag_id: nfcTagId,
      });
    }

    const { attendance, ...meta } = result.data;
    return res.json({
      success: true,
      data: attendance,
      ...meta,
    });
  } catch (error) {
    console.error('Error checking in:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check in',
    });
  }
});

// POST /api/attendance/:ritualId/manual-approve — REMOVED (sonMD: AIS_MANUAL KALDIRILDI)
router.post('/:ritualId/manual-approve', authenticateToken, async (req, res) => {
  try {
    const { ritualId } = req.params;
    const { user_id: participantUserId } = req.body;
    const hostUserId = req.user.userId;

    if (!participantUserId) {
      return res.status(400).json({ success: false, error: 'user_id is required' });
    }

    const result = await approveManualCheckIn(ritualId, hostUserId, participantUserId);
    if (!result.ok) {
      return res.status(result.status).json(result.body);
    }

    return res.json({ success: true, ...result.data });
  } catch (error) {
    console.error('Error approving manual check-in:', error);
    return res.status(500).json({ success: false, error: 'Failed to approve manual check-in' });
  }
});

// POST /api/attendance/cancel - Cancel attendance (son-part.md §7.1)
router.post('/cancel', authenticateToken, async (req, res) => {
  try {
    const { ritual_id, force_without_replacement } = req.body;
    const userId = req.user.userId;

    if (!ritual_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: ritual_id',
      });
    }

    const result = await processAttendanceCancel(userId, ritual_id, {
      force_without_replacement: !!force_without_replacement,
    });

    if (!result.ok) {
      return res.status(result.status).json(result.body);
    }

    return res.status(result.status).json({
      success: true,
      ...result.data,
    });
  } catch (error) {
    console.error('Error cancelling attendance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel attendance',
    });
  }
});

// POST /api/attendance/leave - Leave a ritual early
router.post('/leave', authenticateToken, async (req, res) => {
  try {
    const { ritual_id } = req.body;
    const userId = req.user.userId;

    if (!ritual_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: ritual_id',
      });
    }

    const attendanceCheck = await pool.query(
      'SELECT * FROM ritual_attendance WHERE ritual_id = $1 AND user_id = $2',
      [ritual_id, userId]
    );

    if (attendanceCheck.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'User is not attending this ritual',
      });
    }

    const ritualQuery = await pool.query(
      'SELECT start_time, duration FROM rituals WHERE id = $1',
      [ritual_id]
    );

    if (ritualQuery.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Ritual not found',
      });
    }

    const ritual = ritualQuery.rows[0];
    const ritualStartTime = new Date(ritual.start_time);
    const now = new Date();
    const attendedDuration = (now - ritualStartTime) / 60000;
    const attendancePercentage = (attendedDuration / ritual.duration) * 100;

    const updateQuery = `
      UPDATE ritual_attendance
      SET left_early_at = CURRENT_TIMESTAMP,
          attendance_percentage = $3
      WHERE ritual_id = $1 AND user_id = $2
      RETURNING *
    `;

    const result = await pool.query(updateQuery, [
      ritual_id,
      userId,
      Math.round(attendancePercentage),
    ]);

    const lateJoinExemptMin = Number(LOCAL_CONFIG.ritual.LATE_JOIN_EXEMPT_MIN || 30);
    const joinedAt = attendanceCheck.rows[0]?.joined_at
      ? new Date(attendanceCheck.rows[0].joined_at)
      : new Date(attendanceCheck.rows[0]?.created_at || now);
    const lateJoinExempt = joinedAt > new Date(ritualStartTime.getTime() + lateJoinExemptMin * 60000);

    if (!lateJoinExempt) {
      const dailyLeaveCap = Number(LOCAL_CONFIG.modSignals?.DAILY_LEAVE_MOD_SIGNAL || 0);
      if (dailyLeaveCap > 0) {
        const leaveCount = await pool.query(
          `SELECT COUNT(*)::int AS c
           FROM ritual_attendance
           WHERE user_id = $1
             AND left_early_at IS NOT NULL
             AND left_early_at::date = CURRENT_DATE`,
          [userId]
        );
        if (Number(leaveCount.rows[0]?.c || 0) >= dailyLeaveCap) {
          try {
            const { maybeEnqueueDailyLeaveReview } = await import('../services/modEngine.js');
            await maybeEnqueueDailyLeaveReview(userId, ritual_id);
          } catch (_e) {
            // best effort
          }
        }
      }
    }

    res.json({
      success: true,
      data: result.rows[0],
      attendancePercentage: Math.round(attendancePercentage),
      late_join_exempt: lateJoinExempt,
    });
  } catch (error) {
    console.error('Error leaving ritual:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to leave ritual',
    });
  }
});

export default router;
