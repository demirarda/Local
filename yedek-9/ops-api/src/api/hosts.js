import express from 'express';
import pool from '../config/database.js';
import { requireOpsAuth } from '../middleware/auth.js';
import { canAccessSection } from '../utils/roles.js';
import { syncHostRitualCount } from '../utils/productionStats.js';

const router = express.Router();
router.use(requireOpsAuth);

function assertHostsAccess(req, res) {
  if (!canAccessSection(req.opsUser.role, 'hosts')) {
    res.status(403).json({ success: false, error: 'Hosts section not available for your role' });
    return false;
  }
  return true;
}

router.get('/', async (req, res) => {
  if (!assertHostsAccess(req, res)) return;
  try {
    const { project_id, status, search } = req.query;
    if (!project_id) {
      return res.status(400).json({ success: false, error: 'project_id required' });
    }

    let where = 'WHERE h.project_id = $1';
    const params = [project_id];
    let idx = 2;

    if (status) {
      where += ` AND h.pipeline_status = $${idx++}`;
      params.push(status);
    }
    if (search?.trim()) {
      where += ` AND (h.display_name ILIKE $${idx} OR h.email ILIKE $${idx})`;
      params.push(`%${search.trim()}%`);
      idx++;
    }

    const result = await pool.query(
      `SELECT h.*, o.name AS owner_name
       FROM ops.ops_host_pipeline h
       LEFT JOIN ops.ops_users o ON o.id = h.owner_id
       ${where}
       ORDER BY h.updated_at DESC`,
      params
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to list hosts' });
  }
});

router.post('/', async (req, res) => {
  if (!assertHostsAccess(req, res)) return;
  try {
    const {
      project_id,
      production_user_id,
      display_name,
      email,
      city,
      pipeline_status,
      host_feedback,
      internal_notes,
      owner_id,
    } = req.body;

    if (!project_id || !display_name?.trim()) {
      return res.status(400).json({ success: false, error: 'project_id and display_name required' });
    }

    const result = await pool.query(
      `INSERT INTO ops.ops_host_pipeline (
        project_id, production_user_id, display_name, email, city,
        pipeline_status, host_feedback, internal_notes, owner_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        project_id,
        production_user_id || null,
        display_name.trim(),
        email || null,
        city || null,
        pipeline_status || 'candidate',
        host_feedback || null,
        internal_notes || null,
        owner_id || req.opsUser.id,
      ]
    );

    const row = result.rows[0];
    if (row.production_user_id) {
      await syncHostRitualCount(row.id, row.production_user_id);
      const refreshed = await pool.query('SELECT * FROM ops.ops_host_pipeline WHERE id = $1', [row.id]);
      return res.status(201).json({ success: true, data: refreshed.rows[0] });
    }

    res.status(201).json({ success: true, data: row });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to create host' });
  }
});

router.patch('/:id', async (req, res) => {
  if (!assertHostsAccess(req, res)) return;
  try {
    const fields = [
      'display_name',
      'email',
      'city',
      'pipeline_status',
      'host_feedback',
      'internal_notes',
      'owner_id',
      'production_user_id',
    ];
    const updates = [];
    const params = [];
    let idx = 1;

    for (const f of fields) {
      if (req.body[f] !== undefined) {
        updates.push(`${f} = $${idx++}`);
        params.push(req.body[f] === '' ? null : req.body[f]);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    updates.push('updated_at = NOW()');
    params.push(req.params.id);

    await pool.query(
      `UPDATE ops.ops_host_pipeline SET ${updates.join(', ')} WHERE id = $${idx}`,
      params
    );

    const row = await pool.query('SELECT * FROM ops.ops_host_pipeline WHERE id = $1', [req.params.id]);
    if (!row.rows[0]) {
      return res.status(404).json({ success: false, error: 'Host not found' });
    }

    res.json({ success: true, data: row.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update host' });
  }
});

router.post('/:id/sync-rituals', async (req, res) => {
  if (!assertHostsAccess(req, res)) return;
  try {
    const host = await pool.query('SELECT * FROM ops.ops_host_pipeline WHERE id = $1', [req.params.id]);
    if (!host.rows[0]) {
      return res.status(404).json({ success: false, error: 'Host not found' });
    }
    if (!host.rows[0].production_user_id) {
      return res.status(400).json({ success: false, error: 'No production user linked' });
    }
    const count = await syncHostRitualCount(host.rows[0].id, host.rows[0].production_user_id);
    const refreshed = await pool.query('SELECT * FROM ops.ops_host_pipeline WHERE id = $1', [req.params.id]);
    res.json({ success: true, data: refreshed.rows[0], rituals_synced: count });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Sync failed' });
  }
});

router.delete('/:id', async (req, res) => {
  if (!assertHostsAccess(req, res)) return;
  await pool.query('DELETE FROM ops.ops_host_pipeline WHERE id = $1', [req.params.id]);
  res.json({ success: true });
});

export default router;
