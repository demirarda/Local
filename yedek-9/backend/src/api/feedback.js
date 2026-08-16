import express from 'express';
import pool from '../config/database.js';
import { authenticateToken } from './auth.js';
import { requireIdentityVerified } from '../middleware/identityGate.js';
import {
  getAcceptedFriendship,
  getFlMetaForPair,
  applyFlOnPeerFeedback,
  fbWeightFromLevel,
} from '../services/friendshipLevel.js';
import { getFeedbackWindowInfo } from '../services/feedbackWindow.js';
import { LOCAL_CONFIG } from '../config/localConfig.js';
import {
  validateChipSelection,
  routeForChip,
  upsertFeedbackChipStats,
  recordOpsChipTelemetry,
} from '../services/chipService.js';

const router = express.Router();

const FEEDBACK_TYPE = {
  P2P: 'p2p',
  P2HOST: 'p2host',
  P2R: 'p2r',
  P2Z: 'p2z',
  P2M: 'p2m',
  P2V: 'p2v',
  R1_SELF: 'r1_self',
  /** EVENT gece-geneli — RS dışı; night report / event aggregate */
  RQ_EVENT: 'rq_event',
};

const FEEDBACK_ANSWER = {
  GREEN: 'green',
  YELLOW: 'yellow',
  RED: 'red',
};

const ATTENDED_STATUSES = ['confirmed', 'checked_in', 'left_early', 'joined'];

function isAttendedStatus(status) {
  return ATTENDED_STATUSES.includes(String(status || ''));
}

async function getRitualRow(ritualId) {
  const r = await pool.query(`SELECT * FROM rituals WHERE id = $1`, [ritualId]);
  return r.rows[0] || null;
}

async function canSubmitPeerFeedback(ritualId, fromUserId, toUserId) {
  if (!toUserId || fromUserId === toUserId) {
    return { allowed: false, reason: 'invalid_target' };
  }

  try {
    const { isRitualUnderMin } = await import('../services/underMinGate.js');
    if (await isRitualUnderMin(ritualId)) {
      return { allowed: false, reason: 'under_min', code: 'UNDER_MIN' };
    }
  } catch (_e) {
    /* ignore */
  }

  const friendship = await getAcceptedFriendship(fromUserId, toUserId);
  if (!friendship) {
    return { allowed: false, reason: 'friends_only' };
  }

  // Block does NOT erase FB eligibility snapshot (sonMD)
  const { hasFeedbackEligibility } = await import('../services/waveBSocial.js');
  const snap = await hasFeedbackEligibility(ritualId, fromUserId, toUserId);

  const ritual = await getRitualRow(ritualId);
  if (!ritual) {
    return { allowed: false, reason: 'ritual_not_found' };
  }

  const windowInfo = getFeedbackWindowInfo(ritual);
  if (!windowInfo.open) {
    return { allowed: false, reason: 'feedback_window_closed', window: windowInfo };
  }

  const isVenEvent =
    String(ritual.origin || '') === 'VEN_EVENT' || Boolean(ritual.event_group_id);

  if (!snap) {
    // VEN_EVENT: main-komşusu kişi-FB yok — sub zaman-kesişimi şart
    if (isVenEvent) {
      try {
        const { usersHaveSubTimeOverlap } = await import('../services/eventSubSealService.js');
        const overlap = await usersHaveSubTimeOverlap(ritualId, fromUserId, toUserId);
        if (!overlap) {
          return {
            allowed: false,
            reason: 'main_only_no_person_fb',
            code: 'EVENT_SUB_OVERLAP_REQUIRED',
          };
        }
        // overlap var ama snapshot eksikse yaz
        const { refreshSubSealFeedbackEligibility } = await import(
          '../services/eventSubSealService.js'
        );
        const subs = await pool.query(
          `SELECT sub_id FROM ritual_event_sub_seals
           WHERE ritual_id = $1 AND actor_user_id = $2
           ORDER BY in_ts DESC LIMIT 1`,
          [ritualId, fromUserId]
        );
        if (subs.rows[0]) {
          await refreshSubSealFeedbackEligibility(ritualId, fromUserId, subs.rows[0].sub_id);
        }
      } catch (_e) {
        return {
          allowed: false,
          reason: 'main_only_no_person_fb',
          code: 'EVENT_SUB_OVERLAP_REQUIRED',
        };
      }
    } else {
      const att = await pool.query(
        `SELECT user_id, status, checkin_at, checkin_phase
         FROM ritual_attendance
         WHERE ritual_id = $1 AND user_id IN ($2, $3)`,
        [ritualId, fromUserId, toUserId]
      );
      if (att.rows.length < 2) {
        return { allowed: false, reason: 'attendance_missing' };
      }
      const stFrom = att.rows.find((x) => x.user_id === fromUserId);
      const stTo = att.rows.find((x) => x.user_id === toUserId);
      const sealed = (row) =>
        row?.checkin_at &&
        String(row.checkin_phase || 'sealed') === 'sealed' &&
        isAttendedStatus(row.status);
      if (!sealed(stFrom) || !sealed(stTo)) {
        return { allowed: false, reason: 'attendance_invalid' };
      }
    }
  }

  const flMeta = await getFlMetaForPair(fromUserId, toUserId);
  return {
    allowed: true,
    reason: 'ok',
    window: windowInfo,
    friendship_level: flMeta.friendship_level,
    fb_count: flMeta.fb_count,
    rs_weight: flMeta.rs_weight,
    eligibility_snapshot: snap || true,
  };
}

async function assertRitualAttendance(ritualId, userId) {
  const attendanceCheck = await pool.query(
    `SELECT * FROM ritual_attendance
     WHERE ritual_id = $1 AND user_id = $2
       AND status NOT IN ('no_show', 'cancelled')
       AND checkin_at IS NOT NULL
       AND COALESCE(checkin_phase, 'sealed') = 'sealed'`,
    [ritualId, userId]
  );
  return attendanceCheck.rows[0] || null;
}

async function assertSelfOrVenueFeedback(ritualId, authUserId, feedbackType, { r1_self, p2v_feeling } = {}) {
  const ritual = await getRitualRow(ritualId);
  if (!ritual) {
    return { allowed: false, reason: 'ritual_not_found' };
  }
  if (ritual.under_min === true) {
    return { allowed: false, reason: 'under_min', code: 'UNDER_MIN' };
  }
  try {
    const { isRitualUnderMin } = await import('../services/underMinGate.js');
    if (await isRitualUnderMin(ritualId)) {
      return { allowed: false, reason: 'under_min', code: 'UNDER_MIN' };
    }
  } catch (_e) {
    /* ignore */
  }
  const windowInfo = getFeedbackWindowInfo(ritual);
  if (!windowInfo.open) {
    return { allowed: false, reason: 'feedback_window_closed', window: windowInfo };
  }
  if (feedbackType === FEEDBACK_TYPE.R1_SELF) {
    if (!r1_self) {
      return { allowed: false, reason: 'r1_self_required' };
    }
    return { allowed: true, reason: 'ok', window: windowInfo };
  }
  if (feedbackType === FEEDBACK_TYPE.P2V || feedbackType === FEEDBACK_TYPE.P2M) {
    if (!p2v_feeling) {
      return { allowed: false, reason: 'p2v_feeling_required' };
    }
    if (!ritual.venue_id) {
      return { allowed: false, reason: 'venue_required' };
    }
    return { allowed: true, reason: 'ok', window: windowInfo, venue_id: ritual.venue_id };
  }
  return { allowed: true, reason: 'ok', window: windowInfo };
}

async function upsertFeedbackRow({
  ritualId,
  authUserId,
  toUserId,
  feedbackType,
  q1_comfort,
  q2_energy,
  p2r_feeling,
  r1_self,
  p2v_feeling,
  friendship_level,
  rs_weight,
  chip_id,
}) {
  const chipGate = validateChipSelection({
    feedbackType,
    chipId: chip_id,
    p2r_feeling,
    p2v_feeling,
    r1_self,
  });
  if (!chipGate.ok) {
    const err = new Error(chipGate.error || 'Invalid chip');
    err.status = 400;
    throw err;
  }
  const resolvedChipId = chipGate.chip_id;
  const resolvedChipRoute = chipGate.chip_route || (resolvedChipId ? routeForChip(resolvedChipId) : null);

  const existingCheck = await pool.query(
    `SELECT id FROM feedback
     WHERE ritual_id = $1
       AND from_user_id = $2
       AND (to_user_id = $3 OR (to_user_id IS NULL AND $3 IS NULL))
       AND feedback_type = $4`,
    [ritualId, authUserId, toUserId || null, feedbackType]
  );

  const levelForDb =
    friendship_level && friendship_level !== 'stranger' ? friendship_level : 'l1';
  const weight = rs_weight != null ? rs_weight : fbWeightFromLevel(levelForDb);

  let result;
  if (existingCheck.rows.length > 0) {
    const updateQuery = `
      UPDATE feedback
      SET q1_comfort = $1,
          q2_energy = $2,
          p2r_feeling = $3,
          r1_self = $4,
          p2v_feeling = $5,
          friendship_level = $6::feedback_friendship_level,
          rs_weight = $7,
          chip_id = $8,
          chip_route = $9,
          created_at = CURRENT_TIMESTAMP,
          submitted_at = CURRENT_TIMESTAMP
      WHERE id = $10
      RETURNING *
    `;
    result = await pool.query(updateQuery, [
      q1_comfort || null,
      q2_energy || null,
      p2r_feeling || null,
      r1_self || null,
      p2v_feeling || null,
      levelForDb,
      weight,
      resolvedChipId,
      resolvedChipRoute,
      existingCheck.rows[0].id,
    ]);
  } else {
    const insertQuery = `
      INSERT INTO feedback (
        ritual_id, from_user_id, to_user_id, rater_id, ratee_id, feedback_type,
        q1_comfort, q2_energy, p2r_feeling, r1_self, p2v_feeling, friendship_level, rs_weight, chip_id, chip_route
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::feedback_friendship_level, $13, $14, $15)
      RETURNING *
    `;
    result = await pool.query(insertQuery, [
      ritualId,
      authUserId,
      toUserId || null,
      authUserId,
      toUserId || null,
      feedbackType,
      q1_comfort || null,
      q2_energy || null,
      p2r_feeling || null,
      r1_self || null,
      p2v_feeling || null,
      levelForDb,
      weight,
      resolvedChipId,
      resolvedChipRoute,
    ]);

    if (
      (feedbackType === FEEDBACK_TYPE.P2P || feedbackType === FEEDBACK_TYPE.P2HOST) &&
      toUserId
    ) {
      await applyFlOnPeerFeedback(authUserId, toUserId);
    }
  }

  // Venue chip stats + ops telemetry
  if (resolvedChipId) {
    try {
      const venueR = await pool.query(`SELECT venue_id FROM rituals WHERE id = $1`, [ritualId]);
      const venueId = venueR.rows[0]?.venue_id;
      const feeling =
        p2v_feeling || p2r_feeling || r1_self || q1_comfort || null;
      if (venueId && feeling) {
        await upsertFeedbackChipStats(venueId, resolvedChipId, feeling);
      }
      await recordOpsChipTelemetry({
        chipId: resolvedChipId,
        ritualId,
        userId: authUserId,
      });
    } catch (_e) {
      /* best effort */
    }
  }

  return result;
}

// GET /api/feedback/window/:ritualId — feedback window status (§4.4)
router.get('/window/:ritualId', authenticateToken, async (req, res) => {
  try {
    const ritual = await getRitualRow(req.params.ritualId);
    if (!ritual) {
      return res.status(404).json({ success: false, error: 'Ritual not found' });
    }
    const attendance = await assertRitualAttendance(req.params.ritualId, req.user.userId);
    if (!attendance) {
      return res.status(403).json({ success: false, error: 'User did not attend this ritual' });
    }
    const window = getFeedbackWindowInfo(ritual);
    const { eventGeneralRqMeta } = await import('../services/eventGeneralRq.js');
    const eventMeta = await eventGeneralRqMeta(ritual.id);
    return res.json({ success: true, data: { ...window, ...eventMeta } });
  } catch (error) {
    console.error('Error fetching feedback window:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch feedback window' });
  }
});

// POST /api/feedback - Submit feedback
router.post('/', authenticateToken, requireIdentityVerified, async (req, res) => {
  try {
    const {
      ritual_id,
      from_user_id,
      to_user_id,
      feedback_type,
      q1_comfort,
      q2_energy,
      p2r_feeling,
      r1_self,
      p2v_feeling,
      chip_id,
    } = req.body;

    const authUserId = req.user?.userId;
    if (!authUserId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    if (!ritual_id || !feedback_type) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: ritual_id, feedback_type',
      });
    }

    if (from_user_id && from_user_id !== authUserId) {
      return res.status(403).json({
        success: false,
        error: 'from_user_id does not match authenticated user',
      });
    }

    // v2 §5: Bildir-ve-ayrıl → FB veremez (alabilir)
    try {
      const { reporterBlockedFromGivingFeedback } = await import('../services/modEngine.js');
      if (await reporterBlockedFromGivingFeedback(authUserId, ritual_id)) {
        const givingToOther =
          feedback_type === FEEDBACK_TYPE.P2P ||
          feedback_type === FEEDBACK_TYPE.P2HOST ||
          feedback_type === FEEDBACK_TYPE.P2V ||
          feedback_type === FEEDBACK_TYPE.R1_SELF ||
          feedback_type === FEEDBACK_TYPE.P2R ||
          feedback_type === FEEDBACK_TYPE.RQ_EVENT;
        if (givingToOther) {
          return res.status(403).json({
            success: false,
            error: 'Bildir ve ayrıl sonrası feedback veremezsin',
            code: 'LEAVE_AFTER_NO_GIVE_FB',
          });
        }
      }
    } catch (_e) {
      /* ignore */
    }

    if (!Object.values(FEEDBACK_TYPE).includes(feedback_type)) {
      return res.status(400).json({ success: false, error: 'Invalid feedback_type' });
    }

    const validAnswers = Object.values(FEEDBACK_ANSWER);
    if (q1_comfort && !validAnswers.includes(q1_comfort)) {
      return res.status(400).json({ success: false, error: 'Invalid q1_comfort value' });
    }
    if (q2_energy && !validAnswers.includes(q2_energy)) {
      return res.status(400).json({ success: false, error: 'Invalid q2_energy value' });
    }
    if (p2r_feeling && !validAnswers.includes(p2r_feeling)) {
      return res.status(400).json({ success: false, error: 'Invalid p2r_feeling value' });
    }
    if (r1_self && !validAnswers.includes(r1_self)) {
      return res.status(400).json({ success: false, error: 'Invalid r1_self value' });
    }
    if (p2v_feeling && !validAnswers.includes(p2v_feeling)) {
      return res.status(400).json({ success: false, error: 'Invalid p2v_feeling value' });
    }

    const resolvedType =
      feedback_type === FEEDBACK_TYPE.P2M ? FEEDBACK_TYPE.P2V : feedback_type;

    // sonMD §7 — şerit sosyal ödül; opener ritüelinde P2H sorulmaz
    if (resolvedType === FEEDBACK_TYPE.P2HOST) {
      return res.status(410).json({
        success: false,
        error: 'P2H is not asked in opener rituals',
        code: 'P2H_OPENER_RITUAL',
      });
    }

    if (
      (feedback_type === FEEDBACK_TYPE.P2P || feedback_type === FEEDBACK_TYPE.P2HOST) &&
      !to_user_id
    ) {
      return res.status(400).json({
        success: false,
        error: 'to_user_id is required for P2P and P2Host feedback',
      });
    }

    if (
      (resolvedType === FEEDBACK_TYPE.P2R ||
        resolvedType === FEEDBACK_TYPE.RQ_EVENT ||
        resolvedType === FEEDBACK_TYPE.P2Z ||
        resolvedType === FEEDBACK_TYPE.P2V ||
        resolvedType === FEEDBACK_TYPE.R1_SELF) &&
      to_user_id
    ) {
      return res.status(400).json({
        success: false,
        error: 'to_user_id should be null for P2R/RQ_EVENT/R1/P2V feedback',
      });
    }

    if (resolvedType === FEEDBACK_TYPE.RQ_EVENT) {
      const { shouldAskEventGeneralRq } = await import('../services/eventGeneralRq.js');
      const ask = await shouldAskEventGeneralRq(ritual_id);
      if (!ask) {
        return res.status(400).json({
          success: false,
          error: 'rq_event yalnız sub’lı EVENT Ritual’larda',
          code: 'EVENT_GENERAL_RQ_NA',
        });
      }
      if (!p2r_feeling) {
        return res.status(400).json({
          success: false,
          error: 'p2r_feeling required for rq_event',
        });
      }
    }

    if (!(await assertRitualAttendance(ritual_id, authUserId))) {
      return res.status(400).json({ success: false, error: 'User did not attend this ritual' });
    }

    let flMeta = null;
    if (resolvedType === FEEDBACK_TYPE.P2P || resolvedType === FEEDBACK_TYPE.P2HOST) {
      const peerGate = await canSubmitPeerFeedback(ritual_id, authUserId, to_user_id);
      if (!peerGate.allowed) {
        return res.status(403).json({
          success: false,
          error:
            peerGate.reason === 'friends_only'
              ? 'Peer feedback requires an accepted friendship'
              : peerGate.reason === 'feedback_window_closed'
                ? 'Feedback window is closed for this ritual'
                : 'Peer feedback is not allowed for this target',
          details: peerGate,
        });
      }
      flMeta = peerGate;
    } else if (resolvedType === FEEDBACK_TYPE.R1_SELF || resolvedType === FEEDBACK_TYPE.P2V) {
      const gate = await assertSelfOrVenueFeedback(ritual_id, authUserId, resolvedType, {
        r1_self,
        p2v_feeling,
      });
      if (!gate.allowed) {
        return res.status(403).json({
          success: false,
          error:
            gate.reason === 'venue_required'
              ? 'Venue feedback only applies to venue rituals'
              : gate.reason === 'feedback_window_closed'
                ? 'Feedback window is closed for this ritual'
                : 'Feedback is not allowed',
          details: gate,
        });
      }
    } else {
      const ritual = await getRitualRow(ritual_id);
      const windowInfo = ritual ? getFeedbackWindowInfo(ritual) : { open: false };
      if (!windowInfo.open) {
        return res.status(403).json({
          success: false,
          error: 'Feedback window is closed for this ritual',
          details: { window: windowInfo },
        });
      }
    }

    const result = await upsertFeedbackRow({
      ritualId: ritual_id,
      authUserId,
      toUserId: to_user_id,
      feedbackType: resolvedType,
      q1_comfort,
      q2_energy,
      p2r_feeling,
      r1_self,
      p2v_feeling,
      friendship_level: flMeta?.friendship_level,
      rs_weight: flMeta?.rs_weight,
      chip_id,
    });

    // v2 §9 — chip→badge signal (auto-grant gated by CHIP_BRIDGE.enabled)
    if (chip_id || result.rows[0]?.chip_id) {
      try {
        const { observeChipForBadgeSignal } = await import('../services/chipBadgeBridgeService.js');
        await observeChipForBadgeSignal({
          userId: authUserId,
          chipId: result.rows[0]?.chip_id || chip_id,
          feedbackId: result.rows[0]?.id,
          ritualId: ritual_id,
          feeling: p2r_feeling || p2v_feeling || q1_comfort || null,
        });
      } catch (_e) {
        /* best effort */
      }
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    if (error?.status === 400) {
      return res.status(400).json({ success: false, error: error.message });
    }
    console.error('Error submitting feedback:', error);
    res.status(500).json({ success: false, error: 'Failed to submit feedback' });
  }
});

// GET /api/feedback/ritual/:ritualId
router.get('/ritual/:ritualId', async (req, res) => {
  try {
    const { ritualId } = req.params;
    const { user_id } = req.query;

    let query = `
      SELECT f.*, u1.name as from_user_name, u2.name as to_user_name
      FROM feedback f
      LEFT JOIN users u1 ON f.from_user_id = u1.id
      LEFT JOIN users u2 ON f.to_user_id = u2.id
      WHERE f.ritual_id = $1
    `;

    const params = [ritualId];
    if (user_id) {
      query += ' AND f.from_user_id = $2';
      params.push(user_id);
    }

    query += ' ORDER BY f.created_at DESC';

    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching feedback:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch feedback' });
  }
});

// POST /api/feedback/batch
router.post('/batch', authenticateToken, requireIdentityVerified, async (req, res) => {
  try {
    const { ritual_id, from_user_id, feedbacks } = req.body;
    const authUserId = req.user?.userId;

    if (!authUserId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    if (!ritual_id || !Array.isArray(feedbacks)) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: ritual_id, feedbacks (array)',
      });
    }

    if (from_user_id && from_user_id !== authUserId) {
      return res.status(403).json({
        success: false,
        error: 'from_user_id does not match authenticated user',
      });
    }

    if (!(await assertRitualAttendance(ritual_id, authUserId))) {
      return res.status(400).json({ success: false, error: 'User did not attend this ritual' });
    }

    // v2 §5: Bildir-ve-ayrıl → FB veremez (alabilir)
    let leaveAfterBlocked = false;
    try {
      const { reporterBlockedFromGivingFeedback } = await import('../services/modEngine.js');
      leaveAfterBlocked = await reporterBlockedFromGivingFeedback(authUserId, ritual_id);
    } catch (_e) {
      leaveAfterBlocked = false;
    }

    const results = [];

    for (const feedback of feedbacks) {
      try {
        const {
          to_user_id,
          feedback_type,
          q1_comfort,
          q2_energy,
          p2r_feeling,
          r1_self,
          p2v_feeling,
          chip_id,
        } = feedback;
        const resolvedType =
          feedback_type === FEEDBACK_TYPE.P2M ? FEEDBACK_TYPE.P2V : feedback_type;

        if (resolvedType === FEEDBACK_TYPE.P2HOST) {
          results.push({
            error: 'P2H is not asked in opener rituals',
            code: 'P2H_OPENER_RITUAL',
            feedback_type: resolvedType,
          });
          continue;
        }

        if (leaveAfterBlocked) {
          const giving =
            resolvedType === FEEDBACK_TYPE.P2P ||
            resolvedType === FEEDBACK_TYPE.P2HOST ||
            resolvedType === FEEDBACK_TYPE.P2V ||
            resolvedType === FEEDBACK_TYPE.R1_SELF ||
            resolvedType === FEEDBACK_TYPE.P2R ||
            resolvedType === FEEDBACK_TYPE.RQ_EVENT;
          if (giving) {
            results.push({
              error: 'Bildir ve ayrıl sonrası feedback veremezsin',
              code: 'LEAVE_AFTER_NO_GIVE_FB',
              feedback_type: resolvedType,
            });
            continue;
          }
        }

        let flMeta = null;
        if (resolvedType === FEEDBACK_TYPE.P2P || resolvedType === FEEDBACK_TYPE.P2HOST) {
          const peerGate = await canSubmitPeerFeedback(ritual_id, authUserId, to_user_id);
          if (!peerGate.allowed) {
            results.push({
              error:
                peerGate.reason === 'friends_only'
                  ? 'Peer feedback requires an accepted friendship'
                  : 'Peer feedback not allowed',
              details: peerGate,
              to_user_id: to_user_id || null,
              feedback_type: resolvedType,
            });
            continue;
          }
          flMeta = peerGate;
        } else if (resolvedType === FEEDBACK_TYPE.R1_SELF || resolvedType === FEEDBACK_TYPE.P2V) {
          const gate = await assertSelfOrVenueFeedback(ritual_id, authUserId, resolvedType, {
            r1_self,
            p2v_feeling,
          });
          if (!gate.allowed) {
            results.push({
              error: gate.reason,
              feedback_type: resolvedType,
            });
            continue;
          }
        } else if (resolvedType === FEEDBACK_TYPE.RQ_EVENT) {
          const { shouldAskEventGeneralRq } = await import('../services/eventGeneralRq.js');
          const ask = await shouldAskEventGeneralRq(ritual_id);
          if (!ask) {
            results.push({
              error: 'rq_event yalnız sub’lı EVENT Ritual’larda',
              code: 'EVENT_GENERAL_RQ_NA',
              feedback_type: resolvedType,
            });
            continue;
          }
          if (!p2r_feeling) {
            results.push({
              error: 'p2r_feeling required for rq_event',
              feedback_type: resolvedType,
            });
            continue;
          }
          const ritual = await getRitualRow(ritual_id);
          const windowInfo = ritual ? getFeedbackWindowInfo(ritual) : { open: false };
          if (!windowInfo.open) {
            results.push({
              error: 'Feedback window is closed for this ritual',
              feedback_type: resolvedType,
            });
            continue;
          }
        } else {
          const ritual = await getRitualRow(ritual_id);
          const windowInfo = ritual ? getFeedbackWindowInfo(ritual) : { open: false };
          if (!windowInfo.open) {
            results.push({
              error: 'Feedback window is closed for this ritual',
              feedback_type: resolvedType,
            });
            continue;
          }
        }

        const result = await upsertFeedbackRow({
          ritualId: ritual_id,
          authUserId,
          toUserId: to_user_id,
          feedbackType: resolvedType,
          q1_comfort,
          q2_energy,
          p2r_feeling,
          r1_self,
          p2v_feeling,
          friendship_level: flMeta?.friendship_level,
          rs_weight: flMeta?.rs_weight,
          chip_id,
        });

        if (result.rows[0]?.chip_id) {
          try {
            const { observeChipForBadgeSignal } = await import('../services/chipBadgeBridgeService.js');
            await observeChipForBadgeSignal({
              userId: authUserId,
              chipId: result.rows[0].chip_id,
              feedbackId: result.rows[0].id,
              ritualId: ritual_id,
              feeling: p2r_feeling || p2v_feeling || q1_comfort || null,
            });
          } catch (_e) {
            /* best effort */
          }
        }

        results.push(result.rows[0]);
      } catch (error) {
        console.error('Error processing feedback:', error);
        results.push({ error: error.message, status: error.status || 500 });
      }
    }

    res.json({ success: true, data: results });
  } catch (error) {
    console.error('Error submitting batch feedback:', error);
    res.status(500).json({ success: false, error: 'Failed to submit batch feedback' });
  }
});

export default router;
