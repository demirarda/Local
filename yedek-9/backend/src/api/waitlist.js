/**
 * Waitlist (Yıldız Listesi) — F1.5 · rol-slot LATER park
 * Mount: /api/later
 * WAITLIST_ENABLED:false → 410 · ROLE_SLOT_ENABLED:false → 410.
 */
import express from 'express';
import pool from '../config/database.js';
import LOCAL_CONFIG from '../config/localConfig.js';
import { authenticateToken } from './auth.js';
import {
  joinWaitlist,
  leaveWaitlist,
  listWaitlist,
  listMyWaitlistEntries,
  getWaitlistStatus,
  promoteWaitlistForRitual,
} from '../services/waitlistService.js';

const router = express.Router();

router.use(authenticateToken);

function waitlistGate(res) {
  if (LOCAL_CONFIG.stubs?.WAITLIST_ENABLED === true) {
    return true;
  }
  res.status(410).json({
    success: false,
    error: 'Waitlist park — LATER',
    code: 'WAITLIST_LATER',
    phase: 'LATER',
    enabled: false,
  });
  return false;
}

function roleSlotOff(res) {
  if (LOCAL_CONFIG.stubs?.ROLE_SLOT_ENABLED === true) {
    return res.status(501).json({
      success: false,
      error: 'Rol-slot henüz implement edilmedi',
      code: 'ROLE_SLOT_TODO',
    });
  }
  return res.status(410).json({
    success: false,
    error: 'Rol-slot park — LATER',
    code: 'ROLE_SLOT_LATER',
    phase: 'LATER',
    enabled: false,
  });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Geçersiz UUID'de 400 döner — Postgres 22P02 yerine anlamlı hata. */
function requireRitualId(res, ritualId) {
  if (UUID_RE.test(String(ritualId || ''))) return true;
  res.status(400).json({ success: false, error: 'Valid ritual_id is required' });
  return false;
}

async function isRitualHost(ritualId, userId) {
  const result = await pool.query(`SELECT host_id FROM rituals WHERE id = $1`, [ritualId]);
  return String(result.rows[0]?.host_id ?? '') === String(userId);
}

// GET /api/later/waitlist — kendi sıralarım
// GET /api/later/waitlist?ritual_id=... — o masanın sırası (host tüm listeyi görür)
router.get('/waitlist', async (req, res) => {
  if (!waitlistGate(res)) return;
  try {
    const userId = req.user.userId;
    const ritualId = req.query.ritual_id;

    if (!ritualId) {
      const entries = await listMyWaitlistEntries(userId);
      return res.json({ success: true, data: entries });
    }
    if (!requireRitualId(res, ritualId)) return;

    const status = await getWaitlistStatus(userId, ritualId);
    const host = await isRitualHost(ritualId, userId);
    return res.json({
      success: true,
      data: {
        ...status,
        queue: host ? await listWaitlist(ritualId) : undefined,
      },
    });
  } catch (error) {
    console.error('Error listing waitlist:', error);
    return res.status(500).json({ success: false, error: 'Failed to list waitlist' });
  }
});

// POST /api/later/waitlist — sıraya gir (masa doluyken)
router.post('/waitlist', async (req, res) => {
  if (!waitlistGate(res)) return;
  try {
    const userId = req.user.userId;
    const ritualId = req.body?.ritual_id;
    if (!requireRitualId(res, ritualId)) return;

    const result = await joinWaitlist(userId, ritualId);
    if (!result.ok) {
      return res.status(result.status).json(result.body);
    }

    const status = await getWaitlistStatus(userId, ritualId);
    return res.status(result.status).json({
      success: true,
      data: { ...status, already_waiting: result.data.already_waiting },
    });
  } catch (error) {
    console.error('Error joining waitlist:', error);
    return res.status(500).json({ success: false, error: 'Failed to join waitlist' });
  }
});

// GET /api/later/waitlist/:ritualId — bu masadaki sıra durumum
router.get('/waitlist/:ritualId', async (req, res) => {
  if (!waitlistGate(res)) return;
  try {
    const userId = req.user.userId;
    const { ritualId } = req.params;
    if (!requireRitualId(res, ritualId)) return;

    const status = await getWaitlistStatus(userId, ritualId);
    const host = await isRitualHost(ritualId, userId);
    return res.json({
      success: true,
      data: {
        ...status,
        queue: host ? await listWaitlist(ritualId) : undefined,
      },
    });
  } catch (error) {
    console.error('Error fetching waitlist status:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch waitlist status' });
  }
});

// DELETE /api/later/waitlist/:ritualId — sıradan çık
router.delete('/waitlist/:ritualId', async (req, res) => {
  if (!waitlistGate(res)) return;
  try {
    const userId = req.user.userId;
    const { ritualId } = req.params;
    if (!requireRitualId(res, ritualId)) return;

    const result = await leaveWaitlist(userId, ritualId);
    if (!result.ok) {
      return res.status(result.status).json(result.body);
    }
    return res.json({ success: true, data: result.data.entry });
  } catch (error) {
    console.error('Error leaving waitlist:', error);
    return res.status(500).json({ success: false, error: 'Failed to leave waitlist' });
  }
});

// POST /api/later/waitlist/:ritualId/promote — host manuel terfi tetikler
router.post('/waitlist/:ritualId/promote', async (req, res) => {
  if (!waitlistGate(res)) return;
  try {
    const userId = req.user.userId;
    const { ritualId } = req.params;
    if (!requireRitualId(res, ritualId)) return;

    if (!(await isRitualHost(ritualId, userId))) {
      return res.status(403).json({ success: false, error: 'Yalnız host terfi tetikleyebilir' });
    }

    const promoted = await promoteWaitlistForRitual(ritualId);
    return res.json({ success: true, data: { promoted, promoted_count: promoted.length } });
  } catch (error) {
    console.error('Error promoting waitlist:', error);
    return res.status(500).json({ success: false, error: 'Failed to promote waitlist' });
  }
});

router.all('/role-slot', (_req, res) => roleSlotOff(res));
router.all('/role-slot/:id', (_req, res) => roleSlotOff(res));

export default router;
