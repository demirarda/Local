import express from 'express';
import pool from '../config/database.js';
import { requireOpsAuth } from '../middleware/auth.js';
import { canAccessSection, canViewAll } from '../utils/roles.js';

const router = express.Router();
router.use(requireOpsAuth);

function assertScreensAccess(req, res) {
  if (!canAccessSection(req.opsUser.role, 'screens')) {
    res.status(403).json({ success: false, error: 'Screens section not available for your role' });
    return false;
  }
  return true;
}

router.get('/', async (req, res) => {
  if (!assertScreensAccess(req, res)) return;
  try {
    const { project_id, design_status, dev_status, target_only, category } = req.query;
    if (!project_id) {
      return res.status(400).json({ success: false, error: 'project_id required' });
    }

    let where = 'WHERE s.project_id = $1';
    const params = [project_id];
    let idx = 2;

    const role = req.opsUser.role;
    if (!canViewAll(role)) {
      if (role === 'designer') {
        where += ` AND (s.designer_id = $${idx} OR s.designer_id IS NULL)`;
        params.push(req.opsUser.id);
        idx++;
      } else if (role === 'developer') {
        where += ` AND (s.developer_id = $${idx} OR s.developer_id IS NULL)`;
        params.push(req.opsUser.id);
        idx++;
      }
    }

    if (design_status) {
      where += ` AND s.design_status = $${idx++}`;
      params.push(design_status);
    }
    if (dev_status) {
      where += ` AND s.dev_status = $${idx++}`;
      params.push(dev_status);
    }
    if (target_only === 'true') {
      where += ' AND s.is_target = true';
    }
    if (category) {
      where += ` AND s.category = $${idx++}`;
      params.push(category);
    }

    const result = await pool.query(
      `SELECT s.*,
        d.name AS designer_name,
        dev.name AS developer_name
       FROM ops.ops_screens s
       LEFT JOIN ops.ops_users d ON d.id = s.designer_id
       LEFT JOIN ops.ops_users dev ON dev.id = s.developer_id
       ${where}
       ORDER BY s.spec_id`,
      params
    );

    const stats = {
      design: { not_started: 0, in_progress: 0, review: 0, done: 0 },
      dev: { not_started: 0, in_progress: 0, qa: 0, done: 0 },
      target_total: 0,
      target_design_done: 0,
      target_dev_done: 0,
    };

    for (const s of result.rows) {
      if (stats.design[s.design_status] !== undefined) stats.design[s.design_status]++;
      if (stats.dev[s.dev_status] !== undefined) stats.dev[s.dev_status]++;
      if (s.is_target) {
        stats.target_total++;
        if (s.design_status === 'done') stats.target_design_done++;
        if (s.dev_status === 'done') stats.target_dev_done++;
      }
    }

    res.json({ success: true, data: { screens: result.rows, stats } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to list screens' });
  }
});

router.post('/', async (req, res) => {
  if (!assertScreensAccess(req, res)) return;
  try {
    const body = req.body;
    if (!body.project_id || !body.spec_id || !body.title) {
      return res.status(400).json({ success: false, error: 'project_id, spec_id, title required' });
    }

    const result = await pool.query(
      `INSERT INTO ops.ops_screens (
        project_id, spec_id, title, category, file_ref, is_target, priority,
        design_status, dev_status, designer_id, developer_id, design_notes, dev_notes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING *`,
      [
        body.project_id,
        body.spec_id,
        body.title,
        body.category || 'other',
        body.file_ref || null,
        body.is_target !== false,
        body.priority || 'medium',
        body.design_status || 'not_started',
        body.dev_status || 'not_started',
        body.designer_id || null,
        body.developer_id || null,
        body.design_notes || null,
        body.dev_notes || null,
      ]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ success: false, error: 'Screen spec_id already exists' });
    }
    res.status(500).json({ success: false, error: 'Failed to create screen' });
  }
});

router.patch('/:id', async (req, res) => {
  if (!assertScreensAccess(req, res)) return;
  try {
    const role = req.opsUser.role;
    const allowed =
      role === 'designer'
        ? ['design_status', 'design_notes', 'file_ref', 'designer_id']
        : role === 'developer'
          ? ['dev_status', 'dev_notes', 'developer_id']
          : [
              'title',
              'category',
              'file_ref',
              'is_target',
              'priority',
              'design_status',
              'dev_status',
              'designer_id',
              'developer_id',
              'design_notes',
              'dev_notes',
            ];

    const updates = [];
    const params = [];
    let idx = 1;

    for (const f of allowed) {
      if (req.body[f] !== undefined) {
        updates.push(`${f} = $${idx++}`);
        params.push(req.body[f] === '' ? null : req.body[f]);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No permitted fields to update' });
    }

    updates.push('updated_at = NOW()');
    params.push(req.params.id);

    await pool.query(
      `UPDATE ops.ops_screens SET ${updates.join(', ')} WHERE id = $${idx}`,
      params
    );

    const row = await pool.query(
      `SELECT s.*, d.name AS designer_name, dev.name AS developer_name
       FROM ops.ops_screens s
       LEFT JOIN ops.ops_users d ON d.id = s.designer_id
       LEFT JOIN ops.ops_users dev ON dev.id = s.developer_id
       WHERE s.id = $1`,
      [req.params.id]
    );

    if (!row.rows[0]) {
      return res.status(404).json({ success: false, error: 'Screen not found' });
    }
    res.json({ success: true, data: row.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update screen' });
  }
});

export default router;
