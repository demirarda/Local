/**
 * Thin production nominations list for ops pitch cards — LOCAL v2 §8
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
    const status = req.query.status || 'pooled';
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const result = await db().query(
      `SELECT id, nominator_id, source, name, lat, lng, note, cluster_key, status, created_at
       FROM venue_nominations
       WHERE ($1::text IS NULL OR $1 = 'all' OR status = $1)
       ORDER BY created_at DESC
       LIMIT $2`,
      [status, limit]
    );
    return res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error(err);
    // Table may not exist on ops-only DB — return empty rather than crash
    if (String(err.message || '').includes('venue_nominations')) {
      return res.json({ success: true, data: [], notice: 'venue_nominations unavailable on this DB' });
    }
    return res.status(500).json({ success: false, error: 'Failed to list nominations' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const role = req.opsUser?.role;
    if (!canAccessSection(role, 'venues') && !canAccessSection(role, 'bridge')) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    const status = req.body?.status || 'reviewed';
    const result = await db().query(
      `UPDATE venue_nominations SET status = $2 WHERE id = $1 RETURNING *`,
      [req.params.id, status]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ success: false, error: 'Not found' });
    }
    return res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: 'Failed to update nomination' });
  }
});

export default router;
