import express from 'express';
import pool from '../config/database.js';
import { requireOpsAuth, requireRole } from '../middleware/auth.js';
import { importGapsToProject, SPEC_GAPS } from '../services/specImport.js';

const router = express.Router();
router.use(requireOpsAuth);

router.get('/spec-gaps/preview', (req, res) => {
  res.json({
    success: true,
    data: {
      count: SPEC_GAPS.length,
      items: SPEC_GAPS.map((g) => ({ title: g.title, column: g.column, priority: g.priority })),
    },
  });
});

router.post('/spec-gaps', requireRole('pm', 'founder'), async (req, res) => {
  try {
    const { project_id, source = 'canon', skip_duplicates = true } = req.body;
    if (!project_id) {
      return res.status(400).json({ success: false, error: 'project_id required' });
    }

    const proj = await pool.query('SELECT id FROM ops.ops_projects WHERE id = $1', [project_id]);
    if (!proj.rows[0]) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    const result = await importGapsToProject(project_id, {
      source: source === 'markdown' ? 'markdown' : 'canon',
      reporterId: req.opsUser.id,
      skipDuplicates: skip_duplicates !== false,
    });

    res.json({ success: true, data: result });
  } catch (err) {
    console.error('Import error:', err);
    res.status(500).json({ success: false, error: 'Import failed' });
  }
});

export default router;
