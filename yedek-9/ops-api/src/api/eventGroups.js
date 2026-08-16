/**
 * Ops event-group CRUD — proxies production ritual_event_groups
 */
import express from 'express';
import { getProductionPool } from '../config/database.js';
import pool from '../config/database.js';
import { requireOpsAuth } from '../middleware/auth.js';
import { canAccessSection } from '../utils/roles.js';

const router = express.Router();
router.use(requireOpsAuth);

function db() {
  return getProductionPool() || pool;
}

router.get('/', async (req, res) => {
  try {
    const role = req.opsUser?.role;
    if (!canAccessSection(role, 'venues') && !canAccessSection(role, 'bridge')) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const result = await db().query(
      `SELECT g.*,
              (SELECT COUNT(*)::int FROM rituals r WHERE r.event_group_id = g.id) AS ritual_count
       FROM ritual_event_groups g
       ORDER BY g.created_at DESC
       LIMIT $1`,
      [limit]
    );
    return res.json({ success: true, data: result.rows });
  } catch (err) {
    if (String(err.message || '').includes('ritual_event_groups')) {
      return res.json({ success: true, data: [], notice: 'ritual_event_groups unavailable' });
    }
    return res.status(500).json({ success: false, error: 'Failed to list event groups' });
  }
});

router.post('/', async (req, res) => {
  try {
    const role = req.opsUser?.role;
    if (!canAccessSection(role, 'venues') && !canAccessSection(role, 'bridge')) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ success: false, error: 'name required' });
    const result = await db().query(
      `INSERT INTO ritual_event_groups (name, zone_id, capacity_total, created_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, req.body?.zone_id || null, req.body?.capacity_total || null, null]
    );
    return res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Create failed' });
  }
});

router.post('/:id/rituals', async (req, res) => {
  try {
    const role = req.opsUser?.role;
    if (!canAccessSection(role, 'venues') && !canAccessSection(role, 'bridge')) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    const ritualId = req.body?.ritual_id;
    if (!ritualId) return res.status(400).json({ success: false, error: 'ritual_id required' });
    const result = await db().query(
      `UPDATE rituals SET event_group_id = $2 WHERE id = $1 RETURNING id, title, event_group_id`,
      [ritualId, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, error: 'Ritual not found' });
    return res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Attach failed' });
  }
});

export default router;
