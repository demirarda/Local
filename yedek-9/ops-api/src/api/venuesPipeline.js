import express from 'express';
import pool from '../config/database.js';
import { requireOpsAuth } from '../middleware/auth.js';
import { canAccessSection } from '../utils/roles.js';

const router = express.Router();
router.use(requireOpsAuth);

function assertVenuesAccess(req, res) {
  if (!canAccessSection(req.opsUser.role, 'venues')) {
    res.status(403).json({ success: false, error: 'Venues section not available for your role' });
    return false;
  }
  return true;
}

router.get('/', async (req, res) => {
  if (!assertVenuesAccess(req, res)) return;
  try {
    const { project_id, status, search } = req.query;
    if (!project_id) {
      return res.status(400).json({ success: false, error: 'project_id required' });
    }

    let where = 'WHERE v.project_id = $1';
    const params = [project_id];
    let idx = 2;

    if (status) {
      where += ` AND v.pipeline_status = $${idx++}`;
      params.push(status);
    }
    if (search?.trim()) {
      where += ` AND v.name ILIKE $${idx++}`;
      params.push(`%${search.trim()}%`);
      idx++;
    }

    const result = await pool.query(
      `SELECT v.*, o.name AS owner_name
       FROM ops.ops_venue_pipeline v
       LEFT JOIN ops.ops_users o ON o.id = v.owner_id
       ${where}
       ORDER BY
         CASE v.pipeline_status
           WHEN 'target' THEN 1
           WHEN 'contacted' THEN 2
           WHEN 'negotiating' THEN 3
           WHEN 'agreed' THEN 4
           WHEN 'active' THEN 5
           WHEN 'declined' THEN 6
         END,
         v.name`,
      params
    );

    const grouped = {
      target: [],
      contacted: [],
      negotiating: [],
      agreed: [],
      active: [],
      declined: [],
    };
    for (const row of result.rows) {
      if (grouped[row.pipeline_status]) grouped[row.pipeline_status].push(row);
    }

    res.json({ success: true, data: { list: result.rows, grouped } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to list venues' });
  }
});

router.post('/', async (req, res) => {
  if (!assertVenuesAccess(req, res)) return;
  try {
    const {
      project_id,
      production_venue_id,
      name,
      city,
      address,
      contact_name,
      contact_email,
      pipeline_status,
      internal_notes,
      owner_id,
    } = req.body;

    if (!project_id || !name?.trim()) {
      return res.status(400).json({ success: false, error: 'project_id and name required' });
    }

    const result = await pool.query(
      `INSERT INTO ops.ops_venue_pipeline (
        project_id, production_venue_id, name, city, address,
        contact_name, contact_email, pipeline_status, internal_notes, owner_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        project_id,
        production_venue_id || null,
        name.trim(),
        city || null,
        address || null,
        contact_name || null,
        contact_email || null,
        pipeline_status || 'target',
        internal_notes || null,
        owner_id || req.opsUser.id,
      ]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to create venue' });
  }
});

router.patch('/:id', async (req, res) => {
  if (!assertVenuesAccess(req, res)) return;
  try {
    const fields = [
      'name',
      'city',
      'address',
      'contact_name',
      'contact_email',
      'pipeline_status',
      'internal_notes',
      'owner_id',
      'production_venue_id',
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
      `UPDATE ops.ops_venue_pipeline SET ${updates.join(', ')} WHERE id = $${idx}`,
      params
    );

    const row = await pool.query('SELECT * FROM ops.ops_venue_pipeline WHERE id = $1', [req.params.id]);
    if (!row.rows[0]) {
      return res.status(404).json({ success: false, error: 'Venue not found' });
    }
    res.json({ success: true, data: row.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update venue' });
  }
});

router.delete('/:id', async (req, res) => {
  if (!assertVenuesAccess(req, res)) return;
  await pool.query('DELETE FROM ops.ops_venue_pipeline WHERE id = $1', [req.params.id]);
  res.json({ success: true });
});

export default router;
